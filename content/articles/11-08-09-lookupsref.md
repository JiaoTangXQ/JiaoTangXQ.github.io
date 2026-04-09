---
title: "lookups 通过 ref 进入点击资格，说明流式时期的交互判断要稳口音"
slug: "11-08-09-lookupsref"
date: 2026-04-09
topics: [终端界面]
summary: "`Messages.tsx` 的点击判断不是每次重建函数，而是让 `lookupsRef.current` 始终指向最近一次 `buildMessageLookups` 的结果。这样 `isItemC..."
importance: 1
---

# lookups 通过 ref 进入点击资格，说明流式时期的交互判断要稳口音

## 实现链
`Messages.tsx` 的点击判断不是每次重建函数，而是让 `lookupsRef.current` 始终指向最近一次 `buildMessageLookups` 的结果。这样 `isItemClickable` 可以稳定存在，同时还能根据最新的 `toolUseByToolUseID`、`resolvedToolUseIDs` 和 `erroredToolUseIDs` 做判断。换句话说，数据更新和函数身份被拆开了。

## 普通做法
更普通的做法，是把 `lookups` 直接作为闭包变量传进回调，或者把所有点击判断写成纯渲染时逻辑。

## 为什么不用
流式消息会不断刷新，但交互判断不能跟着每次刷新换说法。若同一个条目在几次渲染间被算成不同的可点击状态，用户就会感到按钮时有时无，像是界面自己没定下来。

## 代价
ref 方案让逻辑看起来绕了一点，也要求读者知道最新 lookup 是从 ref 里拿的。可这种绕法换来的，是交互口径和消息流速分离。
