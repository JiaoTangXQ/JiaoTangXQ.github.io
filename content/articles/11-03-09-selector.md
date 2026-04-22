---
title: "React 模式：为什么把路由逻辑提取到 selectors.ts 纯函数里，而不是写在组件内？"
slug: "11-03-09-selector"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# React 模式：为什么把路由逻辑提取到 selectors.ts 纯函数里，而不是写在组件内？

组件里的 if-else 是技术债的温床——每次需求变化，你要找到那个掺杂着渲染逻辑的判断，小心翼翼地修改。

Claude Code 的 `selectors.ts` 展示了另一种做法：把复杂的派生逻辑提取到纯函数，组件只负责消费结果。

---

## selectors.ts 的完整内容

```typescript
// selectors.ts（从源码还原）

/**
 * Selectors for deriving computed state from AppState.
 * Keep selectors pure and simple - just data extraction, no side effects.
 */

export function getViewedTeammateTask(
  appState: Pick<AppState, 'viewingAgentTaskId' | 'tasks'>,
): InProcessTeammateTaskState | undefined {
  const { viewingAgentTaskId, tasks } = appState
  if (!viewingAgentTaskId) return undefined
  const task = tasks[viewingAgentTaskId]
  if (!task) return undefined
  if (!isInProcessTeammateTask(task)) return undefined
  return task
}

export type ActiveAgentForInput =
  | { type: 'leader' }
  | { type: 'viewed'; task: InProcessTeammateTaskState }
  | { type: 'named_agent'; task: LocalAgentTaskState }

export function getActiveAgentForInput(appState: AppState): ActiveAgentForInput {
  const viewedTask = getViewedTeammateTask(appState)
  if (viewedTask) {
    return { type: 'viewed', task: viewedTask }
  }

  const { viewingAgentTaskId, tasks } = appState
  if (viewingAgentTaskId) {
    const task = tasks[viewingAgentTaskId]
    if (task?.type === 'local_agent') {
      return { type: 'named_agent', task }
    }
  }

  return { type: 'leader' }
}
```

文件顶部的注释说得很清楚：`Keep selectors pure and simple - just data extraction, no side effects.`

---

## 这段逻辑如果留在组件里会怎样

想象 `PromptInput` 里直接有这段逻辑：

```tsx
function PromptInput({ onSubmit, ...props }) {
  const { viewingAgentTaskId, tasks } = useAppState(s => ({
    viewingAgentTaskId: s.viewingAgentTaskId,
    tasks: s.tasks,
  }))
  
  const handleSubmit = (text) => {
    // 在组件里判断路由
    if (viewingAgentTaskId) {
      const task = tasks[viewingAgentTaskId]
      if (task && isInProcessTeammateTask(task)) {
        sendToTeammate(task, text)
        return
      }
      if (task?.type === 'local_agent') {
        sendToNamedAgent(task, text)
        return
      }
    }
    sendToLeader(text)
  }
  
  return <TextInput onSubmit={handleSubmit} />
}
```

这段代码能工作，但有几个问题：

**测试困难**：要测试路由逻辑，必须渲染 `PromptInput`，mock 所有 props，模拟用户提交——只为了测试一个简单的 if-else 分支。

**逻辑重复**：如果另一个地方（比如键盘快捷键处理器）也需要知道「当前活跃的 agent 是谁」，这段逻辑就会被复制。

**修改风险**：修改路由逻辑时，需要在组件的渲染代码中间找到这段处理逻辑，还要确保没有破坏渲染。

---

## 提取成纯函数的收益

**收益一：可独立测试**

```typescript
test('正在查看 teammate 时，路由给 viewed', () => {
  const state = {
    ...mockAppState,
    viewingAgentTaskId: 'task-1',
    tasks: {
      'task-1': mockInProcessTeammateTask,
    },
  }
  const result = getActiveAgentForInput(state)
  expect(result.type).toBe('viewed')
})

test('没有查看任何 teammate 时，路由给 leader', () => {
  const state = { ...mockAppState, viewingAgentTaskId: undefined }
  const result = getActiveAgentForInput(state)
  expect(result.type).toBe('leader')
})
```

不需要渲染任何组件，不需要 mock 任何 React 生命周期，直接传状态、拿结果。

**收益二：返回类型强制消费方处理所有情况**

```typescript
type ActiveAgentForInput =
  | { type: 'leader' }
  | { type: 'viewed'; task: InProcessTeammateTaskState }
  | { type: 'named_agent'; task: LocalAgentTaskState }
```

这是一个 discriminated union。消费方必须处理所有三种情况，TypeScript 会检查。如果加了新的 agent 类型，这里会变成编译错误，提示所有消费方更新。

**收益三：组件变成纯显示**

```tsx
function PromptInput({ ... }) {
  const activeAgent = useAppState(getActiveAgentForInput)
  
  const handleSubmit = (text) => {
    switch (activeAgent.type) {
      case 'leader': sendToLeader(text); break
      case 'viewed': sendToTeammate(activeAgent.task, text); break
      case 'named_agent': sendToNamedAgent(activeAgent.task, text); break
    }
  }
  
  return <TextInput onSubmit={handleSubmit} />
}
```

组件只关心「根据路由结果做什么」，不再关心「路由规则是什么」。

---

## Pick 类型的参数设计

注意 `getViewedTeammateTask` 的参数类型：

```typescript
function getViewedTeammateTask(
  appState: Pick<AppState, 'viewingAgentTaskId' | 'tasks'>,
): InProcessTeammateTaskState | undefined
```

参数不是完整的 `AppState`，而是 `Pick<AppState, 'viewingAgentTaskId' | 'tasks'>`——只要求传入两个字段。

这个设计的意义：

1. **文档性**：函数签名直接说明了它依赖哪些字段，不需要读实现才知道
2. **可测试性**：测试时只需要提供这两个字段，不需要构建完整的 AppState
3. **可复用性**：函数不依赖整个 AppState，可以被传入任何包含这两个字段的对象

---

## 为什么 selector 不能有副作用

`useSyncExternalStore` 会在多个时机调用 `getSnapshot`——包括检测撕裂时。如果 selector 有副作用（比如 `console.log`、写入外部变量），同一次渲染里副作用可能被触发多次，且触发时机不受控。

`selectors.ts` 要求纯函数不只是风格偏好，是 `useSyncExternalStore` 机制的直接要求。

---

## 面试指导

**什么样的逻辑应该提取到 selector 纯函数，什么样的逻辑可以留在组件里？**

提取到纯函数的候选：根据多个状态字段派生出一个结论（路由、权限计算、状态分类）；会被多个地方复用的逻辑；需要独立测试的复杂条件。

留在组件里可以：简单的单字段读取（`useAppState(s => s.verbose)`）；只有这一个组件关心的本地判断。

**discriminated union 在 TypeScript 里为什么好用？**

discriminated union 通过 `type` 字段区分类型变体，TypeScript 能在 switch/if 块里自动收窄类型。如果 switch 没有处理所有情况，TypeScript 会在严格模式下报警。这让「添加新类型」变成「加了新类型之后哪里报错就在哪里加 case」，而不是「找到所有 switch 然后添加 case」。

**`useAppState(getActiveAgentForInput)` 直接传函数引用，和 `useAppState(s => getActiveAgentForInput(s))` 有区别吗？**

行为完全相同，但直接传函数引用更简洁。`useAppState` 接受的参数类型是 `(state: AppState) => T`，`getActiveAgentForInput` 已经符合这个类型，可以直接传入。这也是把 selector 提取为命名函数的额外好处：可以直接作为参数传递，而不需要包装一层 arrow function。
