---
title: "assistant先拉会话历史，说明它先是远端视图"
slug: "08-08-01-assistant"
date: 2026-04-09
topics: [远端与边界]
summary: "- `assistant/sessionHistory.ts` 会先用 `prepareApiRequest()` 拿到 OAuth 和组织信息，然后通过 `anchor_to_latest` 拉最新..."
importance: 1
---

# assistant先拉会话历史，说明它先是远端视图

## 实现链
- `assistant/sessionHistory.ts` 会先用 `prepareApiRequest()` 拿到 OAuth 和组织信息，然后通过 `anchor_to_latest` 拉最新一页事件；`useAssistantHistory.ts` 在 viewerOnly 模式下挂载时立刻触发这条链。
- 这说明 assistant 进入远端会话时，第一件事不是“马上开始控制”，而是先把当前会话当成一个要阅读的远端视图。

## 普通做法
- 普通做法是只连实时流，历史等用户手动点“加载更多”再说，甚至完全不拉。
- 这样首屏更快，实现也更简单。

## 为什么不用
- Claude Code 没把历史当可选装饰，是因为 assistant 的主要姿态就是看现成远端会话。没有先补历史，用户看到的就只是半截现场。
- 从代码看，它把“先形成阅读上下文”放在了“先显示实时流”之前。

## 代价
- 代价是进入 assistant 视图要先多打一轮 API，请求失败时也会先暴露网络问题。
- 但这比一上来只给用户看尾巴更合理。
