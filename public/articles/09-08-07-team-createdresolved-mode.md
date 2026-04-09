---
title: "记录 team_created 时先上报 resolved mode，说明团队制度关心现实不是愿望"
slug: "09-08-07-team-createdresolved-mode"
date: 2026-04-09
topics: [多Agent协作]
summary: "团队分析事件里记的不是用户配置了什么模式，而是最后实际跑成了什么模式。 `TeamCreateTool.ts` 在记录 `tengu_team_created` 时会调用 `getResolvedTe..."
importance: 1
---

# 记录 team_created 时先上报 resolved mode，说明团队制度关心现实不是愿望

团队分析事件里记的不是用户配置了什么模式，而是最后实际跑成了什么模式。

## 实现链

`TeamCreateTool.ts` 在记录 `tengu_team_created` 时会调用 `getResolvedTeammateMode()`。这意味着埋点关心的是最终现实结果，是 `in-process` 还是 `tmux`，而不是抽象的 `auto` 愿望。

## 普通做法

普通做法很容易直接上报配置值，比如用户选了 auto、tmux、in-process 什么就记什么。

## 为什么不用

Claude Code 不满足于记录愿望，因为团队制度要服务现实。如果用户选 auto，但这次实际退回 in-process，那么真正影响协作体验的就是 in-process，不是 auto 这个抽象标签。

## 代价

代价是埋点口径更依赖运行时解析，统计链路稍复杂一点。但分析结果会更可信。
