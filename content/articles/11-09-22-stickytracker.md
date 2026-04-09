---
title: "同一次滚动里列表粗量化而 StickyTracker 细跟随，说明不是所有反馈都该同频"
slug: "11-09-22-stickytracker"
date: 2026-04-09
topics: [终端界面]
summary: "VirtualMessageList 用 coarse quantum 做窗口级别的虚拟化，而 StickyTracker 用 useSyncExternalStore 盯着细粒度 scrollTop..."
importance: 1
---

# 同一次滚动里列表粗量化而 StickyTracker 细跟随，说明不是所有反馈都该同频

## 实现链
VirtualMessageList 用 coarse quantum 做窗口级别的虚拟化，而 StickyTracker 用 useSyncExternalStore 盯着细粒度 scrollTop+delta。两者同读一个滚动源，但更新频率故意不一样。

## 普通做法
普通实现会让列表和 sticky 反馈共用同一个频率更新。那样要么列表太频繁重排，要么 sticky header 跟得太慢。

## 为什么不用
这里不是所有反馈都该同频，因为粗活和细活本来就不是一类预算。列表负责稳定挂载，tracker 负责细跟随，各自按自己的节奏更新更划算。

## 代价
代价是滚动路径被拆成了粗细两层，阅读状态也更难一眼看全。好处是消息列表不会被 sticky 的高频反馈拖慢，header 也不会明显落后。
