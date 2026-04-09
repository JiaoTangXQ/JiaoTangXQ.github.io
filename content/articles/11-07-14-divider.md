---
title: "divider 作为独立兄弟节点，说明切换分界线不该顺手重做所有消息行"
slug: "11-07-14-divider"
date: 2026-04-09
topics: [终端界面]
summary: "`renderMessageRow()` 在 `Messages.tsx` 里不是把 divider 塞进每一行内部，而是用 `flatMap` 返回 `[divider, wrappedRow]` ..."
importance: 1
---

# divider 作为独立兄弟节点，说明切换分界线不该顺手重做所有消息行

## 实现链
`renderMessageRow()` 在 `Messages.tsx` 里不是把 divider 塞进每一行内部，而是用 `flatMap` 返回 `[divider, wrappedRow]` 这样的独立兄弟节点。这样分界线只影响它自己那一小块，不会把每条消息都裹进去一起抖。

## 普通做法
普通列表如果要插一条分界线，常会直接把它和消息行包成一个整体，甚至让整组都跟着重建。

## 为什么不用
Claude Code 里 divider 只是一个局部提示，不是整片消息区的新状态。它要的效果是“在这里切一下”，不是“把所有行都重新出生一遍”。

## 代价
代价是渲染代码看起来没那么直，但换来的是消息行更稳定，分界线开关也更便宜。
