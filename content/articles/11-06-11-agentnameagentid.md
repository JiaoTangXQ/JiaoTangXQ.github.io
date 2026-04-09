---
title: "agentName 和 agentId 双映射，说明团队署名先统一口径再谈显示"
slug: "11-06-11-agentnameagentid"
date: 2026-04-09
topics: [终端界面]
summary: "同一个 teammate 在不同地方可能只写短名，也可能写成带团队后缀的完整 ID。TaskListV2 先把这两种口径统一起来，再谈颜色、活动和 owner 能不能对上。 `TaskListV2.t..."
importance: 1
---

# agentName 和 agentId 双映射，说明团队署名先统一口径再谈显示

同一个 teammate 在不同地方可能只写短名，也可能写成带团队后缀的完整 ID。TaskListV2 先把这两种口径统一起来，再谈颜色、活动和 owner 能不能对上。

## 实现链

`TaskListV2.tsx` 在建 `teammateActivity` 和 `activeTeammates` 时，会同时写入 `bgTask.identity.agentName` 和 `bgTask.identity.agentId` 两个键；`teammateColors` 也是先按 `teamContext.teammates` 里的 `teammate.name` 收口，再映射到主题色。这样一来，后面拿 `task.owner` 查活动、查在线状态时，不管上游给的是短名还是 `name@team`，都能命中同一个人。

## 普通做法

更普通的做法是只约定一种字符串格式，别的格式都当成不同的人，或者干脆不做统一。

## 为什么不用

Claude Code 不能假设上游永远只用一种口径。任务 owner、团队成员和活动来源本来就来自不同链路，如果不先统一名字，颜色和状态就会开始各说各话。

## 代价

代价是这里要多维护一套双键映射，读代码的人也得知道“一个人可能有两种合法写法”。但这比让界面把同一位 teammate 误认成两个人要稳得多。
