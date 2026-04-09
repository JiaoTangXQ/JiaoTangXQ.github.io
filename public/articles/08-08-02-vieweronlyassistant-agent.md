---
title: "viewerOnly说明assistant不是另一套-agent-内核"
slug: "08-08-02-vieweronlyassistant-agent"
date: 2026-04-09
topics: [远端与边界]
summary: "- `RemoteSessionConfig` 里的 `viewerOnly` 会关闭本地 interrupt、关闭 60 秒不响应重连超时，并且不更新远端标题。`useAssistantHistor..."
importance: 1
---

# viewerOnly说明assistant不是另一套-agent-内核

## 实现链
- `RemoteSessionConfig` 里的 `viewerOnly` 会关闭本地 interrupt、关闭 60 秒不响应重连超时，并且不更新远端标题。`useAssistantHistory.ts` 也只在 `viewerOnly` 下工作。
- 这些条件一起说明 assistant 在代码里更像远端会话阅读器，而不是又起了一套本地 agent 内核。

## 普通做法
- 更普通的做法是把 assistant 做成完整远端 agent 客户端，阅读、控制、重连、标题更新全套都开放。
- 这样功能对称，概念上也整齐。

## 为什么不用
- Claude Code 没追求完全对称，是因为 assistant 主要服务的是“看和跟”，不是“在本地复刻一台完整远端控制台”。
- 代码刻意收窄 viewerOnly 行为，就是在强调这不是第二套 agent 内核。

## 代价
- 代价是 assistant 模式功能受限，有些用户会觉得“既然看到了，为什么不能全控”。
- 但这种克制让角色边界更清楚，也减少了和主远端控制链抢权。
