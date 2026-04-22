---
title: "同样是用 lookupsRef，isItemClickable 和 shouldRenderStatically 的读取方式为什么不一样？"
slug: "11-08-09-lookupsref"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# 同样是用 lookupsRef，isItemClickable 和 shouldRenderStatically 的读取方式为什么不一样？

`lookupsRef` 出现在多个地方，但每个地方的读取方式不同。为什么？

## 两种读取模式

**模式一：事件期读取（isItemClickable）**

```typescript
const isItemClickable = useCallback((msg: RenderableMessage) => {
  return computeClickable(msg, lookupsRef.current, tools)
}, [tools])
```

函数在用户 hover 或 click 时被调用，调用时间是任意的（用户行为驱动），需要读最新的 lookups，而函数引用需要稳定。

**模式二：渲染期计算（shouldRenderStatically）**

```typescript
// 在渲染函数体里
const lookups = buildMessageLookups(normalizedMessages, messagesToShow)
lookupsRef.current = lookups

// shouldRenderStatically 也在渲染函数体里被调用，直接用 lookups 变量
const isStatic = shouldRenderStatically(toolUseId, lookups)
```

`shouldRenderStatically` 决定的是当前渲染里一条消息用什么方式渲染，它在渲染过程中被调用，此时 `lookups` 变量已经在作用域里，不需要走 ref。

## 为什么两种方式不统一

这两个函数的**调用时机根本不同**：

- `isItemClickable` 在用户操作时调用（渲染完成后的任意时刻）
- `shouldRenderStatically` 在渲染函数体内调用（每次重渲时同步执行）

渲染函数体内的代码能直接访问这次渲染的局部变量（`lookups`），不需要绕道 ref。ref 的目的是在**渲染完成后仍能访问最新数据**，但如果你就在渲染里，直接用变量就好，没有理由引入间接层。

如果 `shouldRenderStatically` 也走 ref，代码会变成这样：

```typescript
const isStatic = shouldRenderStatically(toolUseId, lookupsRef.current)
```

看起来一样，但是语义错误：`lookupsRef.current` 在赋值语句 `lookupsRef.current = lookups` 之后是最新的，但如果赋值放在函数体下方（代码顺序问题），`shouldRenderStatically` 可能读到上一次渲染的旧 lookups。用局部变量 `lookups` 没有这个问题，它就是本次计算的结果。

## ref 是补丁，不是标准路径

这是理解 `lookupsRef` 的关键心态：**ref 不是"更好的方式"，而是"跨越渲染边界时的补丁"**。

当你需要在渲染之外的时机（事件处理器、setTimeout 回调、useEffect）访问某个值时，ref 是必要的，因为这些地方没有本次渲染的作用域。

当你就在渲染函数体里，局部变量永远比 ref 更直接、更安全、更容易追踪数据流。

## HookProgressMessage 的特殊情况

`HookProgressMessage` 在渲染时需要知道"自己这个 hook 是否已经完成"，它通过 props 接收 `lookups` 对象（不是 ref）：

```typescript
function HookProgressMessage({ msg, lookups, ... }) {
  const hookName = msg.hookName
  const resolvedCounts = lookups.resolvedHookCounts.get(msg.toolUseId)
  const isResolved = (resolvedCounts?.get(hookName) ?? 0) > 0
  // ...
}
```

这里 `lookups` 作为 prop 传入，不是从 ref 读取。消息组件在每次渲染时接受新的 `lookups` prop，React reconciler 决定是否重渲（依赖 prop 变化），这是标准的 React 数据流，不需要 ref。

## 面试指导

这道题的本质是"什么时候用 ref，什么时候用局部变量/prop"的判断训练。

**决策树**：
1. 调用时机在渲染函数体内？→ 用局部变量
2. 调用时机在渲染之外（事件、effect），需要最新数据？→ 用 ref
3. 调用时机在渲染之外，接受数据可以稍旧（稳定 snapshot）→ 用 state 或 context

**常见混淆**：把所有"共享数据"都放进 ref，以为这样能避免不必要的重渲。这是错误的——ref 不触发重渲，但也不保证触发渲染的正确性。如果一个组件的 UI 需要随数据变化，必须用 state/props，不能用 ref 替代。ref 只适合"不需要触发 UI 更新，只需要在调用时读到最新值"的场景。

**加分点**：提到 `jumpState` ref（VirtualMessageList 里），它持有一个包含多个值的对象，目的也是类似的——在两阶段跳转（seek effect）里读取最新的 offsets 和 messages，而不把这些频繁变化的值放进 effect deps 里（放进去会让 effect 在每次渲染后都重跑）。
