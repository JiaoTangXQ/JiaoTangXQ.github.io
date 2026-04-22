---
title: "StickyTracker 用 useSyncExternalStore 订阅滚动事件，不是 useEffect——为什么？"
slug: "11-09-17-stickytracker"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# StickyTracker 用 useSyncExternalStore 订阅滚动事件，不是 useEffect——为什么？

React 里订阅外部数据源有两种主流方式：`useEffect + setState` 和 `useSyncExternalStore`。StickyTracker 用后者，理由是什么？

## StickyTracker 是独立子组件

注意：StickyTracker 不是 VirtualMessageList 自身的状态，而是一个单独渲染的子组件，挂在消息列表末尾：

```typescript
// VirtualMessageList 的 render 里
return (
  <>
    <Box>
      {topSpacer}
      {visibleItems}
      {bottomSpacer}
    </Box>
    {trackStickyPrompt && (
      <StickyTracker
        messages={messages}
        scrollRef={scrollRef}
        getItemTop={getItemTop}
      />
    )}
  </>
)
```

为什么要独立出来？如果 sticky prompt 的计算放在 VirtualMessageList 里，每次滚动都会让整个 VirtualMessageList 重渲（包括所有 VirtualItem）。独立成子组件后，只有 StickyTracker 在滚动时重渲，VirtualMessageList 主体不受影响。

## useSyncExternalStore 的语义

`useSyncExternalStore(subscribe, getSnapshot)` 的约定：

```typescript
// subscribe: 接受一个 callback，当外部数据变化时调用 callback
// getSnapshot: 返回当前外部数据的快照（同步读取）
const scrollTop = useSyncExternalStore(
  (onChange) => {
    const scrollEl = scrollRef.current
    scrollEl?.addEventListener('scroll', onChange)
    return () => scrollEl?.removeEventListener('scroll', onChange)
  },
  () => scrollRef.current?.getScrollTop() ?? 0
)
```

每次 scroll 事件触发，`onChange` 被调用，React 重新调用 `getSnapshot` 获取最新值，如果值变化则触发组件重渲。

## 为什么不用 useEffect

用 `useEffect` 的写法：

```typescript
const [scrollTop, setScrollTop] = useState(0)
useEffect(() => {
  const scrollEl = scrollRef.current
  const handler = () => setScrollTop(scrollEl?.getScrollTop() ?? 0)
  scrollEl?.addEventListener('scroll', handler)
  return () => scrollEl?.removeEventListener('scroll', handler)
}, [scrollRef])
```

两种写法在功能上等价，但有一个关键区别：**tearing（撕裂）**。

在 React Concurrent Mode 下，渲染可能被打断和恢复。如果 `useEffect + setState` 版本在渲染进行中收到新的 scroll 事件，新的 `setScrollTop` 会触发另一次渲染。两次渲染之间，外部数据（scrollTop）已经变了，但第一次渲染里读到的是旧值，第二次渲染读到新值，同一时刻屏幕上可能有来自不同时间点的数据——这就是撕裂。

`useSyncExternalStore` 保证在同一次渲染里所有读取 `getSnapshot` 的组件得到一致的值，React 会在发现撕裂时同步执行一次完整的重渲，强制一致性。

## 为什么 StickyTracker 需要 tearing 保护

Sticky prompt 的功能：在滚动时显示最近的上方用户 prompt。如果 sticky header 里显示的 prompt 和当前实际的滚动位置不匹配（header 还在更新，主内容已经滚到下一个 prompt 位置了），用户会看到 header 和内容"对不上"的短暂状态。

虽然这个 tearing 的时间窗口很短（毫秒级），在快速滚动时会累积成肉眼可见的"header 闪烁"或"header 落后一拍"的感觉。

`useSyncExternalStore` 保证：sticky header 里的 prompt 和内容区的实际位置在每次渲染里严格同步。

## 面试指导

`useSyncExternalStore` 是 React 18 新引入的 Hook，专门为"订阅外部可变状态"设计，但很多人不知道它和 useEffect 的区别。

**什么时候该用 useSyncExternalStore**：
1. 订阅外部数据源（非 React state）：redux store、浏览器 history、DOM 事件
2. 数据源的变化需要被所有 React 组件"同步看到"，不能有 tearing
3. 数据源有同步的"读取当前值"接口（`getSnapshot`）

**什么时候用 useEffect 就够了**：
1. 不需要渲染的副作用（DOM 操作、日志、analytics）
2. 外部数据只更新一次（不是持续订阅）
3. 允许短暂的数据不一致（比如 tooltip 位置，不精确也没关系）

**面试加分点**：提到 `getSnapshot` 需要是稳定的纯函数，两次调用结果相同（React 可能调用多次 getSnapshot 来检测撕裂）。如果 `getSnapshot` 每次调用返回新对象（如 `() => ({ scrollTop: ... })`），React 会认为数据总在变化，导致无限重渲。必须是稳定的 primitive（number、string、boolean）或做深比较。

**追问**：为什么 StickyTracker 是独立子组件而不是一个 hook 放在 VirtualMessageList 里？答：即使用 `useSyncExternalStore` hook，状态更新也会触发调用该 hook 的组件重渲。放在 VirtualMessageList 里 = VirtualMessageList 每次滚动都重渲（包括所有 VirtualItem 的 re-render 检查）。独立子组件把重渲范围限制在 StickyTracker 自身，VirtualMessageList 的渲染不被 scroll 事件打扰。
