---
title: "sentinel和滚动锚定说明assistant先是阅读器再是操作者"
slug: "08-08-04-sentinelassistant"
date: 2026-04-09
topics: [远端与边界]
summary: "- `useAssistantHistory.ts` 用稳定 `sentinelUuid` 表示“loading older messages”“start of session”等占位项，并在 pr..."
importance: 1
---

# sentinel和滚动锚定说明assistant先是阅读器再是操作者

## 实现链
- `useAssistantHistory.ts` 用稳定 `sentinelUuid` 表示“loading older messages”“start of session”等占位项，并在 prepend 前后记录高度差来做 scroll anchoring。
- 这两件事都不是为了操作远端，而是为了让阅读过程不跳、不抖、不失去位置。

## 普通做法
- 普通实现会临时插一个 loading 文本，加载完就删，再靠浏览器或终端默认滚动行为碰碰运气。
- 很多列表在数据量小的时候都这么做。

## 为什么不用
- Claude Code 没把这件事交给默认行为，是因为终端虚拟列表、前插历史和未读分隔线叠在一起时，默认滚动几乎一定会漂。
- 所以它选择明确维护 sentinel 和锚点，把 assistant 当阅读器来精心照顾。

## 代价
- 代价是历史分页逻辑会带上更多 UI bookkeeping。
- 但没有这些细节，assistant 很难成为可长时间使用的阅读界面。
