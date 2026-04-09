---
title: "tool-progress被压成system-message是在拿表达力换统一世界"
slug: "08-06-02-tool-progresssystem-message"
date: 2026-04-09
topics: [远端与边界]
summary: "- `sdkMessageAdapter.ts` 把远端 `tool_progress` 转成普通 `system informational message`，因为本地 `ProgressMessa..."
importance: 1
---

# tool-progress被压成system-message是在拿表达力换统一世界

## 实现链
- `sdkMessageAdapter.ts` 把远端 `tool_progress` 转成普通 `system informational message`，因为本地 `ProgressMessage` 联合类型依赖很多本地工具专用字段，而远端协议并没有给到那一套细节。
- 这里很像一种有意识的压平：牺牲一部分精细表达，换取远端进度仍能进入现有消息世界。

## 普通做法
- 普通做法要么单独为远端进度做一种新消息，要么干脆不显示这类中间态。
- 两种都比“压成 system message”更纯粹。

## 为什么不用
- Claude Code 没再造新类型，是因为一旦新类型出现，渲染、滚动、过滤和状态回写都要学会另一套规则。
- 它宁可接受“进度显示得朴素一点”，也不让远端消息体系从这里开始分叉。

## 代价
- 代价是工具进度的表达力下降，本地看不到那么多专用 UI 细节。
- 但整体上这是合理折中，因为远端进度至少没有因此变成 UI 孤儿。
