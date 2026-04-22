---
title: "registerPostSamplingHook 的实现：回合后插槽如何变成统一的制度入口"
slug: "164-postsamplinghooks"
date: 2026-04-09
topics: [钩子系统, 架构设计, 上下文管理]
importance: 0.9
---

# registerPostSamplingHook 的实现：回合后插槽如何变成统一的制度入口

**面试题：Claude Code 的 postSamplingHooks 解决了什么具体问题？如果不用这个机制，直接在回调里执行会怎样？**

## 问题的起源

在 Claude Code 早期架构里，session memory 的触发逻辑散布在多个地方：有在 turn 结束时直接检查的，有在 tool result 处理完后顺手触发的，还有在 useEffect 里异步检查的。这导致了一个实际 bug：当用户快速连发多条消息时，上一次的 memory 提取还没完成，新的提取又被触发，两个 forked subagent 同时在更新同一个 session_memory.md 文件。

解决方案是把所有回合后操作归到一个有序的插槽里执行。

## registerPostSamplingHook 的接口

```ts
// src/utils/hooks/postSamplingHooks.ts
export type REPLHookContext = {
  messages: Message[]
  agentId: AgentId
  querySource: QuerySource
}

type PostSamplingHook = (ctx: REPLHookContext) => Promise<void>

const hooks: PostSamplingHook[] = []

export function registerPostSamplingHook(hook: PostSamplingHook): () => void {
  hooks.push(hook)
  return () => {
    const idx = hooks.indexOf(hook)
    if (idx >= 0) hooks.splice(idx, 1)
  }
}

export async function executePostSamplingHooks(
  ctx: REPLHookContext,
): Promise<void> {
  for (const hook of hooks) {
    await hook(ctx)
  }
}
```

注意几个设计细节：

**串行执行**：hooks 按注册顺序一个接一个执行，不是并发的。这确保了先注册的 hook（比如 autocompact 检查）完成后，后注册的 hook 才能读到更新后的消息列表状态。

**返回取消函数**：每个 `registerPostSamplingHook` 调用返回一个取消函数。session memory 的 hook 在 agent session 退出时会调用这个取消函数，防止 hook 在 session 结束后还继续执行。

**传入 querySource**：`querySource` 字段让 hook 内部知道当前是主线程查询还是 subagent 查询。session memory 的 hook 会检查这个字段——如果是来自 `session_memory` 或 `compact` 的 querySource，直接返回，防止递归触发。

## session memory 如何挂载到这个插槽

```ts
// src/services/SessionMemory/sessionMemory.ts (节选)
let unregisterHook: (() => void) | undefined

export function initializeSessionMemory(agentId: AgentId): void {
  unregisterHook?.()
  unregisterHook = registerPostSamplingHook(async (ctx) => {
    if (ctx.querySource === 'session_memory') return
    if (ctx.querySource === 'compact') return
    if (!isSessionMemoryGateEnabled()) return

    await maybeExtractSessionMemory(ctx.messages, ctx.agentId)
  })
}
```

这里的 `querySource` 检查解决了递归问题：session memory 提取本身会 fork 一个 subagent 去执行，那个 subagent 也有自己的 postSamplingHooks 执行路径。如果不过滤 querySource，提取 session memory 的 agent 自己也会触发 session memory 提取，进入无限递归。

## 为什么不用 useEffect 代替

React 的 `useEffect` 在每次渲染后异步执行，而渲染在 Claude Code 里是高频的（每条 streaming token 都会触发重渲染）。如果把 session memory 检查放在 useEffect 里：

1. 每次 streaming chunk 渲染后都会执行一次检查，即使 AI 还在生成回复
2. 无法保证在 AI 采样**完全结束后**才执行
3. React StrictMode 的双重 effect 执行会导致两次 memory 提取

postSamplingHooks 在采样 API 调用返回后同步触发，和渲染周期解耦，没有这些问题。

## 这个模式在 Claude Code 里的其他用途

除了 session memory，还有几个系统使用了 postSamplingHooks：

**compact 警告检查**：在每次采样后检查 token 用量，决定是否显示"上下文即将耗尽"的警告条。

**统计上报**：在每次采样后记录 token 用量和工具调用次数，用于后台分析。

**技能调用追踪**：在每次采样后检查是否有新的 skill tool 被调用，更新技能调用记录。

所有这些操作都有一个共同特征：它们需要在 AI 完整回答之后执行，而不是在回答过程中执行，也不需要用户等待它们完成才能继续输入。postSamplingHooks 的串行、异步、后置特性完美匹配了这些需求。

## 面试要点

**Q：postSamplingHooks 的串行执行会不会让每个 turn 变慢？**

会有轻微影响，但这是设计上的权衡。session memory 提取用的是 forked subagent，主要耗时在 API 调用，但这个调用在后台异步进行——hook 触发后会立刻返回（通过提取锁防止重复），实际的 subagent 跑在后台。只有在 autocompact 路径下，主线程才会等待压缩完成，因为压缩后的消息列表必须在下一次用户输入之前就绪。

**Q：如果一个 hook 抛出异常，会影响后续 hook 吗？**

从实现来看，`executePostSamplingHooks` 没有 try-catch 包裹单个 hook，异常会直接冒泡。这是一个合理的设计：postSamplingHooks 里的操作（memory 提取、autocompact 检查）都有自己内部的错误处理，不应该让外层调用处理它们的内部错误。如果 hook 本身逻辑有 bug，让它冒泡出来比静默吞掉要好。
