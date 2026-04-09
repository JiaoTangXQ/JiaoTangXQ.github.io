---
title: "点击资格回调只让 lookups 走 ref，说明流式时期交互口音不能跟着消息抖"
slug: "11-08-07-lookupsref"
date: 2026-04-09
topics: [终端界面]
summary: "`Messages.tsx` 里真正负责交互的不是每次都换壳的内联函数，而是 `useCallback([tools])` 固定下来的 `isItemClickable`。它把变化很快的 `looku..."
importance: 1
---

# 点击资格回调只让 lookups 走 ref，说明流式时期交互口音不能跟着消息抖

## 实现链
`Messages.tsx` 里真正负责交互的不是每次都换壳的内联函数，而是 `useCallback([tools])` 固定下来的 `isItemClickable`。它把变化很快的 `lookups_0` 存进 `lookupsRef.current`，然后在判断时读最新值。这个路径和 `buildMessageLookups` 配合得很紧，因为 lookup 一旦更新，点击资格立刻能用新工具映射和新结果状态，但回调身份本身不需要变。

## 普通做法
更普通的做法，是把 `lookups_0` 直接放进 callback 依赖里。那样虽然更容易写，但函数会随着每次消息更新重新生成。

## 为什么不用
流式界面最怕“函数身份也跟着现实一起抖”。如果点击判断不断换壳，鼠标 hover、延迟绑定和局部重渲染都可能出现一帧内的前后不一致，交互就会显得发飘。

## 代价
这样写多了一层间接访问，读代码时不能只看参数，还要知道 ref 里藏了最新状态。可这点间接性换来的，是消息在流、函数不流。
