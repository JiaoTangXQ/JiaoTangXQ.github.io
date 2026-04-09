---
title: "合成-assistant-tool_use-不是伪造，而是为了接回本地裁决"
slug: "08-07-01-assistant-tool-use"
date: 2026-04-09
topics: [远端与边界]
summary: "- `createSyntheticAssistantMessage()` 会把远端 `can_use_tool` 请求包装成一个本地 `assistant` 消息，里面塞一个 `tool_use` ..."
importance: 1
---

# 合成-assistant-tool_use-不是伪造，而是为了接回本地裁决

## 实现链
- `createSyntheticAssistantMessage()` 会把远端 `can_use_tool` 请求包装成一个本地 `assistant` 消息，里面塞一个 `tool_use` content block。这样本地现有的 `ToolUseConfirm` 流程就能继续工作。
- 所以这里的“合成”不是伪造事实，而是把远端权限请求翻译回本地制度早就认识的语言。

## 普通做法
- 普通做法是给远端权限单独做一套弹窗结构，不再经过本地的 assistant/tool_use 模型。
- 这样看起来更贴近远端来源。

## 为什么不用
- Claude Code 没重做一套审批对象，是因为本地权限系统本来就是围绕 assistant 发起的 tool_use 构建的。
- 如果远端请求不先翻成这个形状，本地整条审批链就得重写一份远端版。

## 代价
- 代价是消息来源看起来有点“人工拼装”，读源码时必须知道这是制度桥接而不是模型真输出。
- 但这个代价换来的复用率非常高。
