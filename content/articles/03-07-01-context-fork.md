---
title: "面试题：context: fork 的命令和普通 prompt 命令，执行路径有哪些不同？"
slug: "03-07-01-context-fork"
date: 2026-04-09
topics: [输入与路由]
importance: 1
---

# 面试题：context: fork 的命令和普通 prompt 命令，执行路径有哪些不同？

## 分叉点

在 `getMessagesForSlashCommand` 的 `prompt` 分支里：

```typescript
case 'prompt': {
  if (command.context === 'fork') {
    return await executeForkedSlashCommand(...)  // ← 分叉
  }
  return await getMessagesForPromptSlashCommand(...)  // ← 普通 prompt
}
```

`command.context === 'fork'` 这一行是分叉点。两条路的差异是：

**普通 prompt 路径**：技能内容注入当前会话 → 主循环继续 → 模型在当前 context 里推理

**fork 路径**：创建独立 agent → 独立 context → 独立 token 预算 → 结果回填主会话

## executeForkedSlashCommand 做了什么

### 同步路径（用户主动调用的 skill）

```typescript
// 准备 fork 上下文
const {
  skillContent,
  modifiedGetAppState,
  baseAgent,
  promptMessages
} = await prepareForkedCommandContext(command, args, context)

// 收集子 agent 消息
const agentMessages: Message[] = []
for await (const message of runAgent({
  agentDefinition,
  promptMessages,
  toolUseContext: { ...context, getAppState: modifiedGetAppState },
  ...
})) {
  agentMessages.push(message)
  // 显示进度 UI
  progressMessages.push(createProgressMessage(message))
  updateProgress()
}

// 提取结果文本
const resultText = extractResultText(agentMessages, 'Command completed')

// 返回结果消息（不是 shouldQuery: true）
return {
  messages: [
    createUserMessage({ content: formatCommandInput(command, args) }),
    createUserMessage({ content: `<local-command-stdout>\n${resultText}\n</local-command-stdout>` }),
  ],
  shouldQuery: false,  // ← 子 agent 执行完，主循环不继续推理
  command,
  resultText
}
```

子 agent 完全执行完，结果作为「命令输出」写回主会话，不触发主会话的额外推理。

### 异步路径（KAIROS 模式下的定时任务）

```typescript
if (feature('KAIROS') && (await context.getAppState()).kairosEnabled) {
  // 立即返回，不等子 agent
  void (async () => {
    // 等 MCP 连接就绪
    while (Date.now() < deadline) {
      if (!mcpPending) break
      await sleep(MCP_SETTLE_POLL_MS)
    }
    
    // 后台运行子 agent
    for await (const message of runAgent({ ..., isAsync: true })) {
      agentMessages.push(message)
    }
    
    // 结果重新进入队列（isMeta: true，用户不可见）
    enqueuePendingNotification({
      value: `<scheduled-task-result command="/${commandName}">...\n${resultText}\n</scheduled-task-result>`,
      mode: 'prompt',
      priority: 'later',
      isMeta: true,
      skipSlashCommands: true,
    })
  })()
  
  // 立即返回空结果
  return { messages: [], shouldQuery: false, command }
}
```

在 KAIROS（助手模式）下，定时任务触发的 fork skill 不等待执行完成——主线程立刻返回，子 agent 在后台异步运行，完成后把结果以 `isMeta` 消息的形式重新入队，触发一轮新的主 agent 推理（决定是否通过 SendUserMessage 汇报）。

## 为什么要 fork

**普通 prompt 命令的 token 预算问题**：

如果 `/commit` 是普通 prompt 命令，commit 推理会在当前会话的 context 里进行。当前会话可能已经有很长的对话历史，大量 token 被占用，commit 推理的结果会和当前会话历史混在一起，压缩时也更难管理。

**fork 解决了什么**：

fork 的子 agent 有独立的 context 和 token 预算，执行重量级任务不会把当前会话撑爆。执行结果以结构化文本返回，主会话只看到「`/commit` 的输出是 xxx」，不看到子 agent 的整个推理过程。

## MCP settle 等待逻辑

异步 fork 路径里有一段有趣的代码：

```typescript
const deadline = Date.now() + MCP_SETTLE_TIMEOUT_MS  // 10秒
while (Date.now() < deadline) {
  const s = context.getAppState()
  if (!s.mcp.clients.some(c => c.type === 'pending')) break
  await sleep(MCP_SETTLE_POLL_MS)  // 200ms 轮询
}
const freshTools = context.options.refreshTools?.() ?? context.options.tools
```

定时任务在启动时（session 初始化阶段）触发，MCP 服务器可能还没连接好。等 MCP 就绪后再用最新的工具集（`freshTools`）运行子 agent，避免子 agent 在 MCP 未就绪时开始执行，工具集不完整。

---

*面试指导：被问到「如何在 agent 里实现子任务的异步执行」时，fork + 结果重新入队这个模式是一个很好的例子。核心是「子 agent 异步执行，结果以 isMeta 消息入队，触发主 agent 处理」——这是 Claude Code 里多 agent 协调的基础机制之一。*
