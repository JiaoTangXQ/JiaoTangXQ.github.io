---
title: "mid-turn 消息注入为什么必须等到轮次边界才交付？"
slug: "05-08-02-pendingmessagesagent"
date: 2026-04-09
topics: [任务与分派]
summary: "用户给正在运行的子 Agent 发消息，消息不会立刻送达，而是进入 pendingMessages 队列，等到工具调用轮次边界才被 drainPendingMessages 统一交付。为什么？"
importance: 1
---

# mid-turn 消息注入为什么必须等到轮次边界才交付？

Claude Code 里，用户可以通过 `SendMessage` 工具给一个正在后台运行的子 Agent 发消息。这条消息会发生什么？

```typescript
export function queuePendingMessage(
  taskId: string,
  msg: string,
  setAppState: (f: (prev: AppState) => AppState) => void,
): void {
  updateTaskState<LocalAgentTaskState>(taskId, setAppState, task => ({
    ...task,
    pendingMessages: [...task.pendingMessages, msg],
  }))
}
```

消息被追加到任务状态里的 `pendingMessages` 数组。它不会立刻送给 Agent，而是在那里等待。

等待什么？

```typescript
export function drainPendingMessages(
  taskId: string,
  getAppState: () => AppState,
  setAppState: (f: (prev: AppState) => AppState) => void,
): string[] {
  const task = getAppState().tasks[taskId]
  if (!isLocalAgentTask(task) || task.pendingMessages.length === 0) {
    return []
  }
  const drained = task.pendingMessages
  updateTaskState<LocalAgentTaskState>(taskId, setAppState, t => ({
    ...t,
    pendingMessages: [],  // 清空队列
  }))
  return drained  // 返回消息列表
}
```

等待 `drainPendingMessages()` 在**工具调用的轮次边界**被调用。

注释里已经点明："Messages queued mid-turn via SendMessage, drained at tool-round boundaries"。

## 为什么不立刻送达

Claude API 的对话是轮次制的（turn-based）。一轮对话包括：

1. 发送请求：`[system prompt, ...历史消息, user: "请做X"]`
2. Claude 响应：`assistant: ["我来做X", tool_use: {name: "Bash", input: {...}}]`
3. 执行工具，准备下一轮
4. 发送下一轮请求：`[...之前的历史, user: [tool_result: {...}]]`

这个轮次结构是 Claude API 的工作方式：assistant 消息和 user 消息交替出现，每个 assistant 消息后面紧跟着对应的 tool_result。

如果在一轮的中途（比如 Claude 正在生成响应，或者工具正在执行）突然插入一条新消息，就会破坏这个轮次结构：

- Claude 正在生成内容时，API 请求已经在飞，无法中途修改
- 工具正在执行时，系统在等待 tool_result，插入新消息会造成消息序列不合法

等到**工具调用轮次边界**（工具执行完毕，准备发下一轮 API 请求时），才把 `pendingMessages` 里的内容拼进 user 消息，是唯一能保证上下文合法的时机。

## drainPendingMessages 的调用时机

`drainPendingMessages` 在 `runAgent.ts` 里的执行循环中被调用，具体位置是每次工具调用完成、准备进入下一轮之前：

```typescript
// runAgent.ts 里（简化）
while (shouldContinue) {
  // 发 API 请求，得到 assistant 消息
  const response = await callClaudeAPI(messages)

  // 执行所有工具
  const toolResults = await executeTools(response.toolUses)

  // 此时进入轮次边界：在发下一轮请求之前，drain pending messages
  const pending = drainPendingMessages(taskId, getAppState, setAppState)
  if (pending.length > 0) {
    toolResults.push({
      role: 'user',
      content: pending.map(msg => ({ type: 'text', text: msg }))
    })
  }

  // 准备下一轮：把 tool_results（含 pending messages）加入历史
  messages = [...messages, ...assistantMessages, ...toolResults]
}
```

这样，pending messages 被自然地合并进 tool_result 消息，作为 user 消息的一部分出现在合法的位置，不破坏轮次结构。

## appendMessageToLocalAgent：UI 更新和 pendingMessages 的区别

有时候容易混淆两个操作：

**`queuePendingMessage()`**：把消息加进 `pendingMessages` 队列，等待被送给 Agent 的 API 输入。这是"给 Agent 发一条指令"。

**`appendMessageToLocalAgent()`**：把消息加进内存里的 `messages` 数组，用于 UI 展示。这是"在 transcript 里显示这条消息"。

```typescript
export function appendMessageToLocalAgent(
  taskId: string,
  message: Message,
  setAppState: (f: (prev: AppState) => AppState) => void,
): void {
  updateTaskState<LocalAgentTaskState>(taskId, setAppState, task => ({
    ...task,
    messages: [...(task.messages ?? []), message],
  }))
}
```

注释里明确说明了两者的关系："queuePendingMessage and resumeAgentBackground route the prompt to the agent's API input but don't touch the display."

用户给后台 Agent 发消息时，两个操作都会发生：
- `appendMessageToLocalAgent()`：让用户在面板里立刻看到自己发的消息
- `queuePendingMessage()`：把这条消息排队，等待被注入 Agent 的下一轮 API 请求

## 面试要点

**消息队列 + 轮次边界**是一个在任何 turn-based 对话系统里都适用的模式。

核心约束：**API 请求是原子的**（发出去就不能再修改）。所有"注入"操作都必须在请求发出之前完成，在正在进行的请求里没有注入时机。

两种策略：
1. **等待当前轮次结束**：把新消息排队，当前轮结束后在下一轮开始前注入。适合"优先完成当前轮次"的场景。
2. **中断当前轮次**：abort 当前 API 请求，把新消息加入历史，重新发请求。适合"消息优先级高于当前任务"的场景。

Claude Code 选择了策略 1（等待轮次边界），因为子 Agent 的执行完整性比消息即时性更重要——宁可消息晚几秒送达，也不要打断 Agent 正在进行的推理。
