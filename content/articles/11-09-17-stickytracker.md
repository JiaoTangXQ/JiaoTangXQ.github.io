---
title: "StickyTracker 单独拆开，说明细粒度反馈不该拖整个列表重排"
slug: "11-09-17-stickytracker"
date: 2026-04-09
topics: [终端界面]
summary: "StickyTracker 作为独立子组件挂在 VirtualMessageList 末尾，并且自己用 useSyncExternalStore 订阅 scrollRef。这样它能每个滚动 tick ..."
importance: 1
---

# StickyTracker 单独拆开，说明细粒度反馈不该拖整个列表重排

## 实现链
StickyTracker 作为独立子组件挂在 VirtualMessageList 末尾，并且自己用 useSyncExternalStore 订阅 scrollRef。这样它能每个滚动 tick 都更新，但不会把整条消息列表一起拉进重排。

## 普通做法
普通实现会把 sticky header 的计算塞回父列表里，跟消息渲染共用一次更新。那样每个 wheel tick 都会把整棵列表一起拖着跑。

## 为什么不用
这里要的是细粒度反馈，不是整表重绘。把 tracker 拆开以后，header 能细跟随，列表本身仍然保持粗粒度虚拟化。

## 代价
代价是 scroll 状态要从两个地方读，逻辑边界也更碎。好处是 sticky prompt 的响应足够细，而不至于把整条 transcript 的渲染预算吃光。
