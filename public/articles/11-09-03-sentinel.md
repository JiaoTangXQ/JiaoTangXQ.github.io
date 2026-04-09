---
title: "稳定 sentinel 让加载更多看起来像同一条阅读缝"
slug: "11-09-03-sentinel"
date: 2026-04-09
topics: [终端界面]
summary: "useVirtualScroll 不只是算一个窗口，它还要输出 topSpacer 和 bottomSpacer，把未挂载的那段消息伪装成连续的空白区。VirtualMessageList 因此能在消..."
importance: 1
---

# 稳定 sentinel 让加载更多看起来像同一条阅读缝

## 实现链
useVirtualScroll 不只是算一个窗口，它还要输出 topSpacer 和 bottomSpacer，把未挂载的那段消息伪装成连续的空白区。VirtualMessageList 因此能在消息增删、滚动和重排时保持同一条阅读缝。

## 普通做法
普通列表通常只把可见项直接堆出来，超出窗口的内容要么消失，要么在滚动时重新拼接。用户看到的会是换了一段列表，不是继续往下读同一条 transcript。

## 为什么不用
这里不能让虚拟化暴露成断层，因为长会话里阅读感比是否真的挂载了全部 DOM 更重要。稳定 sentinel 的作用就是把断层藏起来，让滚动、追加和补挂载都仍像一条线。

## 代价
代价是 spacer、高度缓存和测量逻辑都得和真实内容严格对齐。好处是列表可以伸得很长，但用户仍然感觉自己在同一条 transcript 里移动。
