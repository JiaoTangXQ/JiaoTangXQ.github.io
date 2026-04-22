---
title: "post-sampling hooks 是什么？和 stop hooks 有什么区别？"
slug: "10-09-02-postsamplinghooks"
date: 2026-04-09
topics: [上下文管理]
importance: 1
---

# post-sampling hooks 是什么？和 stop hooks 有什么区别？

Claude Code 有两个"回合后"钩子机制：`postSamplingHooks` 和 `stopHooks`。乍看相似，实际上覆盖的时机和语义完全不同。

---

## post-sampling hooks 的定义

```typescript
// postSamplingHooks.ts

export type PostSamplingHook = (context: REPLHookContext) => Promise<void> | void

const postSamplingHooks: PostSamplingHook[] = []

export function registerPostSamplingHook(hook: PostSamplingHook): void {
  postSamplingHooks.push(hook)
}

export async function executePostSamplingHooks(
  messages: Message[],
  systemPrompt: SystemPrompt,
  userContext: { [k: string]: string },
  systemContext: { [k: string]: string },
  toolUseContext: ToolUseContext,
  querySource?: QuerySource,
): Promise<void> {
  const context: REPLHookContext = {
    messages, systemPrompt, userContext, systemContext, toolUseContext, querySource,
  }
  for (const hook of postSamplingHooks) {
    try {
      await hook(context)
    } catch (error) {
      logError(toError(error))
      // 不重新抛出 — hook 错误不应该影响主流程
    }
  }
}
```

几个关键特征：
1. **内部注册机制**（不在 settings.json 里配置）：注释写明 "not exposed in settings.json config (yet), only used programmatically"
2. **错误静默**：hook 抛出异常时只记录日志，不影响主流程
3. **返回 void**：hooks 不能返回任何数据给主流程

---

## 调用时机：每次 API 采样后

在 `query.ts` 里，`executePostSamplingHooks` 的调用位置：

```typescript
// 工具执行完毕，准备下一轮 API 调用之前
// 或者本轮没有工具调用（最终回应）之后
await executePostSamplingHooks(
  [...messagesForQuery, ...assistantMessages, ...toolResults],
  systemPrompt,
  userContext,
  systemContext,
  toolUseContext,
  querySource,
)
```

具体地说，这发生在：
- 每次模型 API 调用流式结束后
- 工具调用结果收集完毕后
- **包括工具调用循环中的每一个 API round**

这意味着在一个包含 5 次工具调用的会话里，`executePostSamplingHooks` 会触发至少 5 次（每次工具调用都会有一次 API 采样）。

对比：`handleStopHooks` 只在整个 turn 结束时（模型最终回应，`needsFollowUp=false`）触发一次。

---

## 时机对比图

```
用户问："帮我重构这个函数"
  ↓
API Call 1: 模型决定要读文件
  → executePostSamplingHooks (round 1)
  ↓
FileRead 执行
  ↓
API Call 2: 模型决定要编辑文件
  → executePostSamplingHooks (round 2)
  ↓
FileEdit 执行
  ↓
API Call 3: 模型生成最终回应（无工具调用）
  → executePostSamplingHooks (round 3)
  → handleStopHooks ← 只有这里触发
```

---

## REPLHookContext：共享的上下文结构

post-sampling hooks 和 stop hooks 接受相同的 `REPLHookContext`：

```typescript
export type REPLHookContext = {
  messages: Message[]         // 完整消息历史（含 assistant responses）
  systemPrompt: SystemPrompt
  userContext: { [k: string]: string }
  systemContext: { [k: string]: string }
  toolUseContext: ToolUseContext
  querySource?: QuerySource
}
```

两者的 context 类型相同，但传入的 `messages` 内容不同：
- post-sampling hooks 的 messages 包含到当前 API round 为止的所有消息
- stop hooks 的 messages 包含整个 turn 完成后的所有消息

---

## 为什么 post-sampling hooks 不能阻塞

设计上，post-sampling hooks 是纯观察接口——它们不能阻止流程继续，不能插入新消息，不能修改状态。

原因：这些 hooks 在工具调用循环中间触发。如果它们能阻塞，就意味着在"读了一个文件之后"可以暂停整个会话——这不是预期行为，也很难解释给用户。

stop hooks（用户配置的 Stop hooks）可以阻塞，但它们只在整个 turn 结束时触发，阻塞的语义是"在向用户展示下一轮回应之前先运行某个脚本"，用户能理解这个暂停的含义。

---

## 现实中 post-sampling hooks 用来做什么

源码注释说"only used programmatically"，结合 Claude Code 的架构，post-sampling hooks 的实际用途包括：

1. **统计和监控**：记录每次 API 调用的 token 使用量、工具调用频率
2. **调试工具**：在开发和测试阶段，观察每次采样后的消息状态
3. **测试断言**：在集成测试里，验证每次 API 调用后的中间状态

这些都是"读取信息但不修改行为"的场景，和 post-sampling hooks 的只读语义完全匹配。

---

## 错误处理的哲学差异

post-sampling hooks 的错误处理是静默的：
```typescript
try {
  await hook(context)
} catch (error) {
  logError(toError(error))
  // 继续执行下一个 hook，不中断主流程
}
```

stop hooks 的用户配置部分（`executeStopHooks`）可以产生 blocking errors：
```typescript
if (result.blockingError) {
  blockingErrors.push(userMessage)
  yield userMessage
}
```

这个差异反映了两类 hooks 的定位：
- post-sampling hooks 是内部的、观察性的，出错了悄悄记录就行
- stop hooks 是面向用户的、有副作用的，用户的脚本出错了需要告知用户

---

## 整理时机的完整图景

综合来看，Claude Code 有这样的"回合后"时机体系：

| 时机 | 机制 | 触发频率 | 可阻塞 | 用途 |
|------|------|---------|--------|------|
| 每次 API 采样后 | postSamplingHooks | 每轮多次 | 否 | 观察、统计 |
| 整个 turn 结束 | handleStopHooks - 内部任务 | 每 turn 一次 | 否 | 记忆提炼、auto-dream |
| 整个 turn 结束 | handleStopHooks - 用户 Stop hooks | 每 turn 一次 | 是 | 用户自定义脚本 |
| compact 发生时 | executePreCompactHooks | 每次 compact | 是 | 注入 compact 指令 |
| compact 完成后 | processSessionStartHooks('compact') | 每次 compact | 否 | 重注入环境信息 |

这个体系把"整理动作"按粒度和副作用等级分层，不同的整理需求用不同的钩子。

---

## 面试指导

"post-sampling hooks 和 stop hooks 有什么区别"是一道考察你对"事件驱动架构中触发时机粒度"理解的题。

关键区分：
1. **触发频率**：post-sampling 是每次 API round，stop 是每个完整 user turn
2. **副作用能力**：post-sampling 只读，stop hooks 可以阻塞和修改流程
3. **注册方式**：post-sampling 是 programmatic（代码注册），stop hooks 是 user-configured（配置文件）
4. **错误语义**：post-sampling 静默，stop hooks 错误可见给用户

能说清楚"为什么需要两种不同粒度的钩子，而不是一种"，说明你理解了不同整理需求对"介入时机"有不同要求，统一成一个时机会损失灵活性或引入不必要的复杂性。
