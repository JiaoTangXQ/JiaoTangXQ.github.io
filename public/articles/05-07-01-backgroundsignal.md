---
title: "backgroundSignalResolvers：一个 Map 是怎么实现有序转场协议的？"
slug: "05-07-01-backgroundsignal"
date: 2026-04-09
topics: [任务与分派]
importance: 1
---

# backgroundSignalResolvers：一个 Map 是怎么实现有序转场协议的？

`LocalAgentTask.tsx` 里有一个模块级变量：

```typescript
// Map of taskId -> resolve function for background signals
// When backgroundAgentTask is called, it resolves the corresponding promise
const backgroundSignalResolvers = new Map<string, () => void>()
```

这个 Map 存放所有处于前台运行状态的 Agent 任务的 Promise resolver。当某个 Agent 需要转到后台时，调用这个 resolver，对应的 `backgroundSignal` Promise 就 resolve，执行循环感知到信号，释放前台控制。

整套机制非常精简：一个 Map，一个 Promise，一次 `resolve()`。

## 生命周期：创建

`registerAgentForeground()` 在注册前台任务时创建 resolver 并存入 Map：

```typescript
// 创建 backgroundSignal Promise，把 resolver 存起来
let resolveBackgroundSignal: () => void
const backgroundSignal = new Promise<void>(resolve => {
  resolveBackgroundSignal = resolve
})
backgroundSignalResolvers.set(agentId, resolveBackgroundSignal!)

registerTask(taskState, setAppState)
```

`backgroundSignal` 是一个 pending 的 Promise，它的 resolver 被外化到了 Map 里。这个 Promise 不会自动 resolve，只有当 Map 里的函数被调用时才会 resolve。

`backgroundSignal` 被返回给调用者（`AgentTool.tsx`），放进 `Promise.race`：

```typescript
const result = await Promise.race([
  runAgent(...),
  backgroundSignal.then(() => BACKGROUND_SENTINEL),
])
```

只要 `backgroundSignal` 一直 pending，`runAgent()` 就独占 `Promise.race`，同步等待 Agent 完成。

## 生命周期：触发

`backgroundAgentTask()` 被用户触发（点击"转后台"按钮）或超时触发时：

```typescript
const resolver = backgroundSignalResolvers.get(taskId)
if (resolver) {
  resolver()                            // 调用 resolver，Promise resolve
  backgroundSignalResolvers.delete(taskId)  // 立刻从 Map 删掉
}
```

三行代码做了三件事：
1. 从 Map 里取出 resolver
2. 调用它，让 `backgroundSignal` resolve
3. 从 Map 里删掉（一次性，resolver 只能触发一次）

`backgroundSignal` 一旦 resolve，`Promise.race` 返回 `BACKGROUND_SENTINEL`，执行循环感知到"该交棒了"。

## 生命周期：清理

如果 Agent 在还没被转后台的情况下就完成了（正常结束或出错），Map 里会剩下一个 orphan resolver。这个 resolver 不会被调用，也永远不会 resolve。

需要清理，否则 Map 会随着时间积累而增长（内存泄漏）。

清理时机在任务完成时，通过 `unregisterCleanup` 机制：

```typescript
// registerAgentForeground 里
const unregisterCleanup = registerCleanup(async () => {
  killAsyncAgent(agentId, setAppState)
})
taskState.unregisterCleanup = unregisterCleanup
```

任务完成时调用 `task.unregisterCleanup?.()`，注销全局清理钩子。但 `backgroundSignalResolvers` Map 里的 resolver 需要额外清理——这通常在 `AgentTool.tsx` 的执行循环完成后处理（通过 `cancelAutoBackground?.()` 等清理路径）。

## autoBackgroundMs：超时触发器

`registerAgentForeground` 支持 `autoBackgroundMs` 参数：

```typescript
if (autoBackgroundMs !== undefined && autoBackgroundMs > 0) {
  const timer = setTimeout((setAppState, agentId) => {
    // 改状态
    setAppState(prev => {
      const prevTask = prev.tasks[agentId]
      if (!isLocalAgentTask(prevTask) || prevTask.isBackgrounded) return prev
      return {
        ...prev,
        tasks: {
          ...prev.tasks,
          [agentId]: { ...prevTask, isBackgrounded: true },
        },
      }
    })
    // 触发信号
    const resolver = backgroundSignalResolvers.get(agentId)
    if (resolver) {
      resolver()
      backgroundSignalResolvers.delete(agentId)
    }
  }, autoBackgroundMs, setAppState, agentId)

  cancelAutoBackground = () => clearTimeout(timer)
}
```

关键：`setTimeout` 里做的事情和手动 `backgroundAgentTask()` 完全相同：改 `isBackgrounded`，resolve Promise，清理 Map。

两种触发方式（手动和超时）走的是同一条路径。这种统一保证了：手动能正常转后台的，超时一定也能正常转后台，不存在"一种方式有 bug 另一种没问题"的情况。

## 为什么 resolver 要外化到 Map 而不是存在任务对象上

一个替代设计：把 resolver 直接存到 `LocalAgentTaskState`：

```typescript
type LocalAgentTaskState = TaskStateBase & {
  // ...
  backgroundSignalResolver?: () => void  // 存在任务对象上
}
```

这样的问题：

1. **React 状态里不应该存函数**。React 的状态更新是通过比较引用相等性来判断是否需要重渲染的。函数引用每次创建都不同，把函数存进状态会导致每次更新都是"新的"，无法利用引用相等性优化。

2. **序列化问题**。`AppState` 可能需要被序列化（比如写日志、调试查看），函数不能被序列化。

3. **闭包持有引用**。把 resolver 存进状态对象，意味着这个对象的每个副本（React `setState` 会产生很多快照）都持有一个函数闭包，增加内存压力。

外化到模块级 Map 解决了所有这些问题：任务状态对象只存数据，函数放在模块级的隐式存储里。

## 面试要点

`backgroundSignalResolvers` 是一个**外部化 Promise 控制**的经典模式（又叫 Deferred 模式）：

通常 Promise 的控制权在创建它的一方（`new Promise(resolve => ...)`）。把 `resolve` 函数存到外部，就把控制权转移了：现在任何拿到 Map 的人，都可以 resolve 这个 Promise。

这个模式在需要"从外部触发 Promise"的场景非常有用，比如：信号量、取消令牌、事件驱动的等待机制。

代价是内存管理需要手动处理（Map 里的 resolver 需要显式清理），比普通 Promise 更容易出现泄漏。但在生命周期明确（任务完成或被 kill 时清理）的场景下，这个代价完全可控。
