---
title: "远端审批先合成assistantMessage说明制度先对齐再谈真实出处"
slug: "08-07-03-assistantmessage"
date: 2026-04-09
topics: [远端与边界]
summary: "- `useRemoteSession.ts` 收到权限请求后，会先创建 synthetic assistant message，再把它和工具对象一起放进本地确认队列。也就是说，审批的第一步不是追问“..."
importance: 1
---

# 远端审批先合成assistantMessage说明制度先对齐再谈真实出处

## 实现链
- `useRemoteSession.ts` 收到权限请求后，会先创建 synthetic assistant message，再把它和工具对象一起放进本地确认队列。也就是说，审批的第一步不是追问“这条消息到底从哪来”，而是先让它进入本地制度可以处理的通道。
- 从实现链看，这是一种很务实的顺序：制度先对齐，出处再通过 requestId、toolUseId 保留下来。

## 普通做法
- 普通做法可能会把远端审批保持成完全远端样式，再在本地做一个转述层。
- 这样来源信息会更原汁原味。

## 为什么不用
- Claude Code 没把出处摆在第一位，是因为本地审批系统真正依赖的是 assistant/tool_use 结构，而不是远端协议长什么样。
- 如果先坚持保持远端原貌，本地制度反而接不住它。

## 代价
- 代价是代码里会出现一些“明知不是原生 assistant message 但仍要这样包装”的绕感。
- 不过这不是概念混乱，而是为了最大化复用现有制度链。
