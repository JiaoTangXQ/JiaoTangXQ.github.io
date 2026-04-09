---
title: "只有viewerOnly才分页历史说明阅读器姿态要贯彻到底"
slug: "08-08-05-vieweronly"
date: 2026-04-09
topics: [远端与边界]
summary: "- `useAssistantHistory.ts` 开头就用 `config?.viewerOnly === true` 做总开关，非 viewer 模式直接 no-op。也就是说，历史分页不是远端..."
importance: 1
---

# 只有viewerOnly才分页历史说明阅读器姿态要贯彻到底

## 实现链
- `useAssistantHistory.ts` 开头就用 `config?.viewerOnly === true` 做总开关，非 viewer 模式直接 no-op。也就是说，历史分页不是远端模式的通用能力，而是阅读器姿态下的专属能力。
- 这让 live remote 控制和远端阅读在代码层就分出了不同职责。

## 普通做法
- 普通做法是只要远端消息列表存在，就统一支持向上翻页加载历史。
- 从功能表面看，这似乎更一致。

## 为什么不用
- Claude Code 没把分页历史扩到所有 remote 模式，是因为 live 控制模式本地本来就在追加消息，还要处理 echo、审批和工具状态。把历史补拉混进来，会让去重和滚动逻辑更脆。
- 它宁可把阅读器姿态贯彻到底，也不拿“功能统一”去换状态混乱。

## 代价
- 代价是两种远端模式的行为不完全一致，读代码时要记住 viewerOnly 这条线。
- 但这正是它没有再造第二套内核、而是明确区分角色的结果。
