---
title: "topSpacer 和 bottomSpacer 是怎么让 700 条消息的滚动感觉连续的？"
slug: "11-09-03-sentinel"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# topSpacer 和 bottomSpacer 是怎么让 700 条消息的滚动感觉连续的？

虚拟滚动的核心挑战：DOM 里只有当前可视窗口附近的消息，但滚动条的位置应该反映整个 transcript 的长度。怎么做到的？

## 虚拟滚动的物理模型

普通列表（全量挂载）：scroll container 的真实高度 = 所有消息的高度之和。滚动条位置准确。

虚拟列表（只挂载窗口）：scroll container 里只有 20-30 条消息，真实高度只有全量的几十分之一。如果不做任何处理，滚动条会显示"内容很少"，拖动一小段距离就到底了。

解法：在实际内容的前后各放一个空 Box（spacer），spacer 的高度填充未挂载消息的预估高度，让 scroll container 的总高度接近全量挂载时的高度。

```
┌─────────────────┐ ← scroll container 顶部
│  topSpacer      │ ← 高度 = 前面未挂载消息的预估总高度
│  (0-height Box) │
├─────────────────┤
│  消息 150       │ ← 实际挂载的消息（约 25 条）
│  消息 151       │
│  ...            │
│  消息 174       │
├─────────────────┤
│  bottomSpacer   │ ← 高度 = 后面未挂载消息的预估总高度
│  (0-height Box) │
└─────────────────┘ ← scroll container 底部
```

## 高度的来源：测量 + 估算

每条消息第一次挂载时，通过 `measureRef` 绑定的 ref callback 测量真实高度：

```typescript
const measureRef = useCallback((key: string) => (el: DOMElement | null) => {
  if (!el) return
  const height = el.yogaNode?.getComputedHeight() ?? 0
  if (height !== heightCache.get(key)) {
    heightCache.set(key, height)
    scheduleRecompute()
  }
}, [])
```

已测量的高度存进 `heightCache`（一个 Map），下次这条消息离开视口再回来时直接用缓存高度，不需要重新测量。

未测量的消息（从未出现在视口里）用**估算高度**，通常是所有已测量消息的平均高度或一个默认值。

## offsets 数组

`useVirtualScroll` 维护一个 `offsets` 数组，`offsets[i]` 是第 i 条消息的顶部 y 坐标（相对于 scroll container 顶部）：

```
offsets[0] = 0
offsets[1] = height[0]
offsets[2] = height[0] + height[1]
...
offsets[n] = 所有 0..n-1 消息的高度之和
```

这个数组在每次高度缓存更新时重建（O(n)），但提供 O(log n) 的二分查找：给定 scrollTop，找到第一条顶部 y < scrollTop 的消息（即可视窗口的起始消息）。

spacer 高度的计算：
- `topSpacer` 高度 = `offsets[start]`（前面所有消息的高度之和）
- `bottomSpacer` 高度 = `offsets[n] - offsets[end]`（后面所有消息的高度之和）

## columns 参数的作用

`useVirtualScroll` 接收 `columns` 参数，这是终端宽度（字符数）。当宽度变化时（用户 resize 终端），所有消息的换行方式变化，高度缓存完全失效。

```typescript
// VirtualMessageList 里
if (prevColumns !== columns) {
  heightCache.clear()  // 所有测量值作废
  // 重新估算所有消息高度
}
```

这是一个必须处理的边缘情况：如果忽略宽度变化，窄屏缓存的高度在宽屏下会偏小，spacer 高度算错，滚动条位置错误。

## spacerRef 和 spacer 高度更新

spacer 是实际渲染的 Box 元素，通过 `spacerRef` 引用：

```typescript
const spacerRef = useCallback((key: 'top' | 'bottom') => (el: DOMElement | null) => {
  // 用 Yoga 直接设置高度，避免触发 React re-render
  el?.yogaNode?.setHeight(key === 'top' ? topSpacer : bottomSpacer)
}, [topSpacer, bottomSpacer])
```

注意这里直接操作 Yoga 节点（ink 的布局引擎），而不是通过 React state 更新 height prop，目的是避免因 spacer 高度变化触发的不必要重渲。

## 面试指导

虚拟滚动是面试高频题，但大多数人只能说出"只渲染可见项"。这里有更多细节值得展开。

**必须掌握的要点**：
1. spacer 高度基于缓存高度（已测量）和估算高度（未测量），不是精确的
2. offsets 数组提供 O(log n) 的位置查找，支撑"给定 scrollTop 找起始消息索引"
3. 终端宽度变化时必须清空高度缓存（这是终端环境特有的，Web 端对应的是容器宽度变化）

**一个容易忽略的细节**：spacer 高度估算不精确时会怎样？用户滚动到估算位置，实际内容挂载后真实高度和预估不一致，scrollTop 需要校正，否则内容会"跳"。`useVirtualScroll` 有一个在挂载后校正 scrollTop 的机制，但这个校正本身也可能触发新的测量和新的校正……这是虚拟滚动实现里最难的部分。

**延伸追问**：为什么不用 ResizeObserver 监听每条消息的高度变化，而是用 yogaNode 的 getComputedHeight？答：Claude Code 运行在终端里，用的是 ink（一个基于 Yoga 布局引擎的 React 渲染器），没有 DOM API，没有 ResizeObserver。Yoga 是 ink 的布局引擎，yogaNode.getComputedHeight() 是终端环境里等价于 getBoundingClientRect().height 的操作。
