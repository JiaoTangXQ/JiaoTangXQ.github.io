---
title: "mailbox 连等待和修订都算正式状态，不只是收信箱"
slug: "09-05-03-mailbox"
date: 2026-04-09
topics: [多Agent协作]
summary: "Claude Code 的 mailbox 消息不只是“有一段文本”，它还带上了 `read`、`summary`、`color`、时间戳这些状态。 `TeammateMessage` 结构里有 `f..."
importance: 1
---

# mailbox 连等待和修订都算正式状态，不只是收信箱

Claude Code 的 mailbox 消息不只是“有一段文本”，它还带上了 `read`、`summary`、`color`、时间戳这些状态。

## 实现链

`TeammateMessage` 结构里有 `from`、`text`、`timestamp`、`read`、`color`、`summary`。这意味着 mailbox 不只是个文本管道，而是一个小型通信状态机：谁发的、读没读、预览是什么、视觉上属于谁，都在这里落档。

## 普通做法

普通做法会把消息通道做成最薄的数据层，正文发过去就算完成，其他状态交给 UI 另算。

## 为什么不用

Claude Code 不这么拆，是因为团队通信和任务通信一样，状态本身就是制度的一部分。读没读、谁发的、有没有摘要，不只是显示问题，也影响轮询、提醒和协作节奏。

## 代价

代价是 mailbox 不再“轻”，而会带一点小型消息系统的味道。但这正是它能承担团队通信面的原因。
