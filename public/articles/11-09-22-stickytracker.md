---
title: "粗量化虚拟化，细跟随 sticky：同一个滚动源，两种更新频率"
slug: "11-09-22-stickytracker"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# 粗量化虚拟化，细跟随 sticky：同一个滚动源，两种更新频率

`VirtualMessageList` 和 `StickyTracker` 都订阅同一个滚动容器的滚动事件。但它们的更新模式完全不同。

## 虚拟列表需要粗粒度

虚拟化的核心工作是：计算哪些消息应该挂载（在可见区域），哪些应该卸载（在 spacer 里），以及 top/bottom spacer 的高度。

这是「重活」——每次触发都可能涉及多个 DOM 节点的挂载和卸载。如果每帧都重算，用户滚动时虚拟列表会持续大量操作 DOM，反而比全量渲染更卡。

coarse quantum 的做法是：只有滚动量超过某个阈值（比如当前可见区域高度的 30%），才触发一次窗口重计算。小量滚动时，spacer 尺寸稍微不准，但页面保持流畅；大量滚动时，重算一次，纠正 spacer 和挂载范围。

## StickyTracker 需要细粒度

Sticky header 显示「当前位置对应的是哪个 prompt」。用户滚动时，随着越过不同的 prompt 分界点，header 内容应该更新。

如果 sticky header 也用粗粒度更新，在用户滚过一个 prompt 分界点后，header 还是显示旧的 prompt，要等滚动量够了才更新。这种延迟是可感知的——用户明明已经看到了新的对话，header 还在显示上一个。

`useSyncExternalStore` 让 sticky tracker 订阅每次 `scrollTop` 变化，配合 `delta` 判断方向，使 header 能及时响应位置变化。

## 按职责分配更新频率

这里有一个普遍适用的原则：**不同的消费者对数据新鲜度的要求不同，应该按需分配更新频率**。

虚拟列表追求的是「挂载状态整体上准确」，对实时性要求不高，可以用粗量化换取性能。Sticky header 追求的是「当前显示准确」，对实时性要求高，需要细粒度跟随。

把它们绑在同一个频率上，要么拖慢虚拟列表（用 sticky 的频率），要么让 header 总是慢半拍（用虚拟列表的频率）。分开，各自在自己的职责范围内做最好。
