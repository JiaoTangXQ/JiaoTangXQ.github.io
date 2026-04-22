---
title: "retain 和 evictAfter：Claude Code 如何把人的阅读节奏纳入任务生命周期"
slug: "05-08-03-retainevictafter"
date: 2026-04-09
topics: [任务与分派]
importance: 1
---

# retain 和 evictAfter：Claude Code 如何把人的阅读节奏纳入任务生命周期

`LocalAgentTaskState` 里有两个字段：

```typescript
// UI is holding this task: blocks eviction, enables stream-append, triggers
// disk bootstrap. Set by enterTeammateView. Separate from viewingAgentTaskId
// (which is "what am I LOOKING at") — retain is "what am I HOLDING."
retain: boolean

// Panel visibility deadline. undefined = no deadline (running or retained);
// timestamp = hide + GC-eligible after this time. Set at terminal transition
// and on unselect; cleared on retain.
evictAfter?: number
```

注释里已经把两者的语义说清楚了：

- `retain`：UI 正在"持有"这个任务（用户打开了详细面板）。只要 `retain` 为 `true`，任务就不会被驱逐。
- `evictAfter`：任务进入驱逐倒计时的截止时间（时间戳）。时间到了才驱逐。`undefined` 表示没有截止时间（任务还在运行，或者被持有）。

## 为什么任务完成后不立刻删除

任务完成时（`completeAgentTask` 或 `failAgentTask`）：

```typescript
return {
  ...task,
  status: 'completed',
  result,
  endTime: Date.now(),
  evictAfter: task.retain
    ? undefined                          // 用户正在看：不设截止时间
    : Date.now() + PANEL_GRACE_MS,       // 没人看：30 秒后可驱逐
  abortController: undefined,
  unregisterCleanup: undefined,
  selectedAgent: undefined,
}
```

如果 `retain === false`（没有用户持有），设置 `evictAfter = Date.now() + 30000`（30 秒后可驱逐）。

如果 `retain === true`（用户正在查看），`evictAfter = undefined`（没有截止时间，不会驱逐）。

这意味着：任务完成后，它还有 30 秒的"展示窗口"。在这 30 秒里，用户可以看到任务已完成的状态和输出，而不是任务突然消失。30 秒后，如果用户已经关闭了面板（`retain === false`），任务才会被驱逐。

## PANEL_GRACE_MS 和 STOPPED_DISPLAY_MS 的数值选择

```typescript
export const STOPPED_DISPLAY_MS = 3_000    // 3 秒：killed 任务
export const PANEL_GRACE_MS = 30_000       // 30 秒：completed/failed 任务
```

killed 任务只显示 3 秒：用户按 ESC 强制停止任务，一般只需要确认"已停止"，不需要查看详细输出。

completed/failed 任务显示 30 秒：任务正常完成时，用户可能需要查看结果摘要；任务失败时，用户需要查看错误信息。30 秒是一个"足够用户注意到并阅读"的经验值。

## retain 和 evictAfter 的协同

驱逐检查（`evictTerminalTask`）：

```typescript
export function evictTerminalTask(taskId, setAppState) {
  setAppState(prev => {
    const task = prev.tasks?.[taskId]
    if (!task) return prev
    if (!isTerminalTaskStatus(task.status)) return prev     // 非终态，不驱逐
    if (!task.notified) return prev                         // 未通知，不驱逐
    // 'retain' in task 收窄类型到 LocalAgentTaskState
    if ('retain' in task && (task.evictAfter ?? Infinity) > Date.now()) {
      return prev   // 还没到截止时间，不驱逐
    }
    const { [taskId]: _, ...remainingTasks } = prev.tasks
    return { ...prev, tasks: remainingTasks }
  })
}
```

驱逐的条件是同时满足四个：
1. 任务处于终态（`completed`/`failed`/`killed`）
2. 通知已发（`notified === true`）
3. `evictAfter` 已过期（`task.evictAfter <= Date.now()`）
4. `retain === false`（没有用户持有，由 `(evictAfter ?? Infinity) > Date.now()` 间接保证：`retain` 为 true 时 `evictAfter` 是 `undefined`，`undefined ?? Infinity` 就是 `Infinity`，始终不满足过期条件）

注意 `retain` 和 `evictAfter` 的耦合方式：`retain` 为 `true` 时 `evictAfter` 被设为 `undefined`，而检查时用 `evictAfter ?? Infinity`，等效于"永不驱逐"。这是一个巧妙的设计：不需要在 evict 函数里单独判断 `retain`，只需要检查 `evictAfter` 是否过期。

## retain 的两重语义

注释里有一句区分："Separate from viewingAgentTaskId (which is 'what am I LOOKING at') — retain is 'what am I HOLDING.'"

`viewingAgentTaskId` 是"UI 当前显示的是哪个任务"，这是一个 UI 状态，用于决定哪个任务面板在前台展示。

`retain` 是"UI 正在持有哪个任务"，这是一个任务级别的状态，用于防止被驱逐。`retain` 还有额外效果：

- **启用 stream-append**：`retain = true` 时，系统开始把新到达的 Agent 消息实时 append 到内存里的 `messages` 数组，而不是只写磁盘。
- **触发 disk bootstrap**：`retain` 从 `false` 变 `true` 时（用户打开面板），系统从磁盘加载 transcript 到内存（`diskLoaded` 变为 `true`）。

所以 `retain` 不只是"不要驱逐"，它还是"用户开始主动查看，请切换到高质量显示模式"的信号。

## 面试要点

**把人类因素建模进系统**是产品工程里常被忽略的维度。

纯粹从计算机视角看，任务完成了就应该立刻释放内存，这是最优的。但从用户体验看，任务完成后立刻消失，对用户来说就像文件被删了——你刚看到"完成"，转头再看就不见了。

`retain` 和 `evictAfter` 是一种对"人类阅读时间"的显式建模：

- **Grace period**（`PANEL_GRACE_MS = 30s`）：这是系统对"用户需要多少时间看到结果"的估计
- **User hold**（`retain`）：这是系统对"用户已经主动介入"的感知

这两个机制合在一起，让任务的"逻辑结束"和"物理消失"解耦，中间留出了足够的人类阅读窗口。

在设计任何涉及"完成后展示结果"的系统时，考虑类似机制都是有价值的：任务完成不等于用户已读，内存回收不等于用户体验完成。
