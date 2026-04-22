---
title: "共享 AppState 但各自分仓：Claude Code 的多 Agent 状态管理架构"
slug: "09-03-02-appstate"
date: 2026-04-09
topics: [多Agent协作]
importance: 1
---

# 共享 AppState 但各自分仓：Claude Code 的多 Agent 状态管理架构

React 应用有一个常见的状态管理挑战：多个组件需要共享状态，但又不能互相影响。Claude Code 的多 agent 团队系统面临一个更复杂的版本：多个并发执行的 agent 需要共享 AppState，但每个 agent 的状态必须完全隔离。

它的解法值得仔细看。

## AppState 的结构

`AppState` 里有一个 `tasks` 字段，类型是 `Record<string, TaskState>`——一个以 `taskId` 为键的对象。每个 in-process teammate 对应 `tasks` 里的一个条目，类型是 `InProcessTeammateTaskState`。

```typescript
interface AppState {
  tasks: Record<string, TaskState>
  // ... 其他字段
}
```

`InProcessTeammateTaskState` 包含这个 teammate 的全部状态：

```typescript
interface InProcessTeammateTaskState {
  type: 'in_process_teammate'
  id: string                      // taskId
  status: 'running' | 'killed' | 'completed'
  identity: TeammateIdentity      // agentId, agentName, teamName, color...
  messages: Message[]             // 这个 teammate 的消息历史
  pendingUserMessages: string[]   // 等待注入的消息
  permissionMode: PermissionMode  // plan / default
  isIdle: boolean
  shutdownRequested: boolean
  abortController?: AbortController
  onIdleCallbacks?: (() => void)[]
  // ...
}
```

关键点：**每个 teammate 的 `messages` 是独立数组**，不是所有 teammate 共享的全局消息池。

## 状态更新的精确定位

当 researcher 需要更新自己的状态时，它用的是 `setAppState`，一个标准的 React-style 更新函数：

```typescript
setAppState(prev => ({
  ...prev,
  tasks: {
    ...prev.tasks,
    [myTaskId]: {
      ...prev.tasks[myTaskId],
      isIdle: true,
      // 只更新 researcher 的状态
    }
  }
}))
```

同时，reviewer 也可能在调用同样的 `setAppState`，但它的闭包里的 `myTaskId` 是 reviewer 的，不是 researcher 的。两次更新都指向 `tasks` 对象里不同的键，不会互相覆盖。

这是 immutable state update 模式的典型应用：每次更新都是创建新对象，原来的对象不变，所以并发更新只要使用不同的键，就天然不会冲突。

## 按 AgentId 查询

`InProcessTeammateTask.tsx` 提供了一组专门针对 teammate 的查询函数：

```typescript
function findTeammateTaskByAgentId(
  agentId: string,
  tasks: Record<string, TaskState>
): InProcessTeammateTaskState | undefined

function getRunningTeammates(
  tasks: Record<string, TaskState>
): InProcessTeammateTaskState[]
```

这些函数遍历 `tasks`，按 `identity.agentId` 过滤。这意味着：

1. **查询可以按身份而不是按 taskId**。外部调用方通常知道 `agentId`（比如 `researcher@my-team`），不知道内部的 `taskId`。
2. **类型安全**。函数返回 `InProcessTeammateTaskState`，不是通用的 `TaskState`，调用方不需要自己做类型断言。
3. **状态隔离的查询语义**。`findTeammateTaskByAgentId('researcher@my-team', tasks)` 只返回 researcher 的状态，不会返回 reviewer 的。

## 一个实际的状态更新场景

当 researcher 完成工作，进入 idle 状态，需要通知所有等待 researcher 变 idle 的回调：

```typescript
setAppState(prev => {
  const task = prev.tasks[myTaskId] as InProcessTeammateTaskState

  // 取出所有等待回调
  const callbacks = task.onIdleCallbacks ?? []

  // 更新状态，清空回调列表
  const newTask = {
    ...task,
    isIdle: true,
    onIdleCallbacks: [],  // 清空，避免重复调用
  }

  // 返回新状态
  return {
    ...prev,
    tasks: { ...prev.tasks, [myTaskId]: newTask }
  }
})

// 在状态更新后执行回调（注意：在 setAppState 外面）
callbacks.forEach(cb => cb())
```

这里有一个微妙之处：**回调在 `setAppState` 之外执行**，而不是在更新函数内部。这是因为 `setAppState` 的更新函数应该是纯函数（不产生副作用），回调是副作用，必须在状态更新完成后再执行。

## 与 tmux teammate 的状态对比

Tmux pane teammate 是独立进程，它们的状态不在 AppState 里——leader 只能通过 mailbox 或 team file 了解它们的状态。

这产生了一个有趣的非对称：
- In-process teammate：leader 可以直接读 AppState 获取实时状态
- Tmux teammate：leader 必须通过轮询 mailbox 或读 team file 获取状态

Claude Code 对这个非对称性接受了，没有试图统一成同一种查询接口。因为强行统一（比如把所有状态都写到文件里）会让 in-process 查询变慢；而不统一，只是多一条 `if isInProcess then...else...` 分支。

## 面试怎么答

如果面试题是"多个并发 agent 共享状态对象时，如何防止互相覆盖"：

**核心答案**：分仓，不共享。共享容器（AppState），但容器里按身份分区——每个 agent 只读写自己的分区（`tasks[myTaskId]`）。并发更新的键不同，自然不冲突。

**结合 React 模式**：这和 React 的 immutable state update 模式配合得很好——每次更新都生成新对象，spread 操作保留其他 agent 的状态不变，只替换当前 agent 的部分。不需要锁，不需要事务，语义上是安全的。

**实际工程考虑**：这个模式在读写频率不高时很好用。如果 5 个 agent 每秒都要更新状态，`setAppState` 会产生很多次 React 重渲染。Claude Code 实际上通过 `React.memo` 和 selector 优化了这个问题——界面只有在相关 agent 的状态真正变化时才重渲染。

**延伸问题**：如果不用 React（比如在 Node.js 服务端的多 agent 系统里），可以用 Proxy 对象实现类似的分仓隔离——每个 agent 拿到的是一个 Proxy，Proxy 的读写操作自动加上 agentId 前缀，访问共享存储里正确的区域。
