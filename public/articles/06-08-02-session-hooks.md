---
title: “SessionHooksState 用 Map 而不是 Record：高并发 workflow 的性能设计”
slug: "06-08-02-session-hooks"
date: 2026-04-09
topics: [治理与权限]
summary: “session hooks 用 Map<string, SessionStore> 而不是 Record，原因是 parallel() 并发启动 N 个 agent 时，Record spread 是 O(N²) 而 Map.set 是 O(1)。”
importance: 1
---

# SessionHooksState 用 Map 而不是 Record：高并发 workflow 的性能设计

`sessionHooks.ts` 的 `SessionHooksState` 类型定义：

```typescript
/**
 * Map (not Record) so .set/.delete don't change the container's identity.
 * Mutator functions mutate the Map and return prev unchanged, letting
 * store.ts's Object.is(next, prev) check short-circuit and skip listener
 * notification. Session hooks are ephemeral per-agent runtime callbacks,
 * never reactively read (only getAppState() snapshots in the query loop).
 * Same pattern as agentControllers on LocalWorkflowTaskState.
 *
 * This matters under high-concurrency workflows: parallel() with N
 * schema-mode agents fires N addFunctionHook calls in one synchronous
 * tick. With a Record + spread, each call cost O(N) to copy the growing
 * map (O(N²) total) plus fired all ~30 store listeners. With Map: .set()
 * is O(1), return prev means zero listener fires.
 */
export type SessionHooksState = Map<string, SessionStore>
```

这段注释是 session hooks 设计的完整解释，值得逐句拆解。

## 问题：Record + spread 的 O(N²) 问题

如果 `SessionHooksState` 是 `Record<string, SessionStore>`，添加一个 session hook 的实现会是：

```typescript
// 假设的 Record 版本
setAppState(prev => ({
  ...prev,
  sessionHooks: {
    ...prev.sessionHooks,  // O(N) 复制现有所有 session
    [sessionId]: newStore,
  },
}))
```

当 `parallel()` 启动 N 个并发 agent 时，每个 agent 都调用 `addFunctionHook`，触发上面的 setter：
- 第 1 个 agent：复制 0 个 session，O(1)
- 第 2 个 agent：复制 1 个 session，O(1)
- 第 N 个 agent：复制 N-1 个 session，O(N-1)

总计：O(0+1+...+(N-1)) = O(N²/2) = O(N²)

而且每次 spread 都是不同的对象，`Object.is(next, prev)` 为 false，触发所有 ~30 个 store 监听者重新执行。N 个 agent = N × 30 次监听者通知。

## 解法：Map 的恒等 mutation

```typescript
// 实际的 Map 版本
function addHookToSession(setAppState, sessionId, event, matcher, hook) {
  setAppState(prev => {
    const store = prev.sessionHooks.get(sessionId) ?? { hooks: {} }
    // ... 修改 store ...
    prev.sessionHooks.set(sessionId, { hooks: newHooks })  // 就地修改 Map
    return prev  // 返回同一个 prev！
  })
}
```

关键：`prev.sessionHooks.set(sessionId, ...)` 就地修改 Map，然后 `return prev` 返回同一个对象引用。

这样 `Object.is(next, prev)` 为 true（因为是同一个对象），store 的变化检测短路，30 个监听者不会被通知。

时间复杂度：Map.set 是 O(1)，N 个 agent = O(N) 总时间，没有平方项。

## 适用条件：非响应式读取

这个设计有一个重要前提：session hooks **不被响应式地读取**。

注释写道：
> “Session hooks are ephemeral per-agent runtime callbacks, never reactively read (only getAppState() snapshots in the query loop).”

如果某个 React 组件订阅了 `sessionHooks` 字段，当 Map 被就地修改但引用不变时，组件不会重新渲染——这是设计意图的一部分，session hooks 不需要触发 UI 更新，只需要在 `getAppState()` 快照时被读到。

如果违反这个约定（把 session hooks 绑定到 React 状态），就需要改回 Record + spread 的方式来触发渲染。

## FunctionHook vs HookCommand

session hooks 有两种类型：

```typescript
export type FunctionHook = {
  type: 'function'
  id?: string
  timeout?: number
  callback: FunctionHookCallback  // TypeScript 回调函数，只存在于内存
  errorMessage: string
  statusMessage?: string
}
```

`FunctionHook` 是内存中的 TypeScript 回调，不能持久化到 settings.json。

`HookCommand` 是可以持久化的 shell 命令或 HTTP 请求配置。

两者在 session 里共存，但在序列化时被区别对待：

```typescript
// 转换时过滤掉 FunctionHook
function convertToHookMatchers(sessionMatchers): SessionDerivedHookMatcher[] {
  return sessionMatchers.map(sm => ({
    matcher: sm.matcher,
    hooks: sm.hooks
      .map(h => h.hook)
      .filter((h): h is HookCommand => h.type !== 'function'),  // 过滤
  }))
}
```

`getSessionHooks()` 只返回 `HookCommand`，`getSessionFunctionHooks()` 只返回 `FunctionHook`。调用方根据需要选择。

## removeFunctionHook 的语义

```typescript
export function removeFunctionHook(setAppState, sessionId, event, hookId): void {
  setAppState(prev => {
    const store = prev.sessionHooks.get(sessionId)
    if (!store) return prev

    const updatedMatchers = eventMatchers
      .map(matcher => {
        const updatedHooks = matcher.hooks.filter(h => {
          if (h.hook.type !== 'function') return true  // 保留非 function hooks
          return h.hook.id !== hookId  // 只删除匹配 id 的
        })
        return updatedHooks.length > 0 ? { ...matcher, hooks: updatedHooks } : null
      })
      .filter((m): m is SessionHookMatcher => m !== null)

    prev.sessionHooks.set(sessionId, { hooks: newHooks })
    return prev  // Map mutation，不触发监听者
  })
}
```

注意 `removeFunctionHook` 里的 matcher 更新用了 spread（`{ ...matcher, hooks: updatedHooks }`）——但这只是 matcher 对象本身的 immutable 更新，外层 Map 仍然用就地 mutation + return prev 的模式，不触发 store 监听者。

## 这道题考什么

**O(N²) 问题的识别**：在 parallel() 高并发场景下，Record + spread 的时间和通知复杂度。能主动提出这个问题的候选人说明有性能工程的直觉。

**Map mutation + return prev 的权衡**：这个技巧绕过了 React 的响应式系统，适用于”只在快照里读、不需要触发 UI”的场景。使用前提不对就会踩坑（组件不更新）。

**FunctionHook 不可序列化**：TypeScript 闭包不能 JSON 序列化。这是一个基础的序列化边界问题，在持久化、跨进程通信等场景都会遇到。
