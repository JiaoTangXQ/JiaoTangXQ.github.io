---
title: "VirtualMessageList 为什么要从 Messages.tsx 拆出来？rules-of-hooks 的强制约束"
slug: "11-09-01-virtualmessagelist"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# VirtualMessageList 为什么要从 Messages.tsx 拆出来？rules-of-hooks 的强制约束

很多人以为组件拆分是为了复用或清晰度。这里的拆分理由更直接：React 规则要求它必须这样做。

## 问题：条件式虚拟滚动

Claude Code 支持两种渲染模式：

- **全屏模式**（fullscreen）：使用 `VirtualMessageList`，只挂载可视窗口附近的消息，支持虚拟滚动
- **普通模式**：使用简单的 `.map()`，全量挂载所有消息

两种模式的切换条件是 `isFullscreen`，这个值在运行时决定（用户切换 fullscreen，或根据终端大小自动判断）。

如果 `Messages.tsx` 尝试这样写：

```typescript
function Messages({ isFullscreen, messages }) {
  if (isFullscreen) {
    // ❌ 这里 rules-of-hooks 报错
    const { range, ... } = useVirtualScroll(scrollRef, keys, columns)
    return <VirtualList range={range} ... />
  }
  return messages.map(renderItem)
}
```

React 会在运行时报错或（在 Strict Mode 下）在开发时报错：Hooks must be called unconditionally。

## 解决方式：提前拆成独立组件

```typescript
// Messages.tsx
function Messages({ isFullscreen, messages }) {
  if (isFullscreen) {
    // ✅ 整个组件实例在条件里，内部可以无条件调用 Hook
    return <VirtualMessageList messages={messages} ... />
  }
  return messages.map(renderItem)
}

// VirtualMessageList.tsx
export function VirtualMessageList({ messages, ... }) {
  // useVirtualScroll 在这里无条件调用
  const { range, topSpacer, ... } = useVirtualScroll(scrollRef, keys, columns)
  // ...
}
```

把虚拟滚动相关的所有 Hook 封装进 `VirtualMessageList`，这个组件只在全屏模式下被渲染，在非全屏模式下根本不挂载，也就根本不调用 `useVirtualScroll`。

## useVirtualScroll 里有什么 Hook

`useVirtualScroll` 不是单个 Hook，它内部组合了多个 Hook：

```typescript
function useVirtualScroll(scrollRef, keys, columns) {
  const [range, setRange] = useState<[number, number]>([0, INITIAL_WINDOW])
  const heightCache = useRef<Map<string, number>>(new Map())
  const offsets = useRef<number[]>([])
  // ...更多 useState、useRef、useEffect
}
```

如果这些调用被放在条件语句里，React 在第一次渲染建立的 Hook 调用顺序（React 靠这个顺序区分不同 Hook 的状态）就会在后续渲染里变化，导致状态错乱。

## 拆分之后 VirtualMessageList 承载的责任

拆分不只是为了绕过规则，拆出去的组件同时成为了一个独立的功能单元，承载了：

1. **虚拟滚动窗口计算**：通过 useVirtualScroll 得到 range、spacers、offsets
2. **消息 key 的增量更新**：`keysRef` 的 append-only 优化（避免 O(n) 全量重建）
3. **两阶段搜索跳转**：JumpHandle + seekGen + scanRequestRef
4. **sticky prompt 追踪**：StickyTracker 在滚动时反推当前可见的 prompt
5. **键盘导航**：cursorNavRef 的 MessageActionsNav 实现
6. **hover/click 状态**：hoveredKey 和 onClickK/onEnterK/onLeaveK

这些功能全部依赖 DOM 测量和滚动状态，都只在全屏模式下有意义，放在 VirtualMessageList 里比放在 Messages.tsx 里更合适。

## 面试指导

这道题表面是架构题，实际是考你对 React rules-of-hooks 的理解深度。

**核心规则**：Hook 的调用顺序在每次渲染时必须完全相同。React 内部用调用顺序（第 1 个 hook、第 2 个 hook……）来区分不同 Hook 的状态，如果顺序变化，状态就会乱。条件语句、循环、早返回里调用 Hook 都可能改变顺序。

**正确的解法模式**：需要"有条件地使用某个 Hook"时，要么把 Hook 提升到总是被调用的位置（但可能引入不必要的计算），要么把 Hook 及其依赖的逻辑封装成一个独立组件，让组件本身的条件挂载来控制 Hook 的运行。

**常见错误答案**：用 `isFullscreen && useVirtualScroll(...)` 这样的短路求值。React 编译器和 ESLint 的 hooks 规则插件都会捕获这类写法，但即使 lint 没报，运行时行为也是未定义的。

**加分点**：提到 VirtualMessageList 是渲染两个分支中性能差异最大的一个——全屏模式下 transcript 可能有几百条消息，全量挂载会导致 DOM 节点数量庞大、初始渲染慢、滚动卡顿。拆分让 `useVirtualScroll` 只在需要的时候实例化，完全不影响普通模式的渲染性能。
