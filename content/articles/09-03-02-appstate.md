---
title: "AppState 共享不等于状态搅成一锅"
slug: "09-03-02-appstate"
date: 2026-04-09
topics: [多Agent协作]
summary: "同进程 teammate 共享同一个 `AppState`，但这不代表状态天然混在一起。 `InProcessTeammateTaskState` 为每个 teammate 单独保存 `identit..."
importance: 1
---

# AppState 共享不等于状态搅成一锅

同进程 teammate 共享同一个 `AppState`，但这不代表状态天然混在一起。

## 实现链

`InProcessTeammateTaskState` 为每个 teammate 单独保存 `identity`、`messages`、`pendingUserMessages`、`permissionMode`、`isIdle`、`shutdownRequested` 等字段。`InProcessTeammateTask.tsx` 还提供了按 agentId 查找、按运行态筛选、按名字排序的专门函数。共享的是一个大状态仓库，不是一个无差别对象。

小白可以把它想成一家公司共用同一个 HR 系统，但每个人仍然有自己的档案卡。

## 普通做法

普通做法会觉得共享状态就应该直接读写同一批数组或变量，谁要什么就从里面拿。

## 为什么不用

Claude Code 没这么写，是因为共享容器不等于共享语义。只要成员状态不分仓，界面就没法稳定显示“谁在干嘛”，权限也没法按成员回溯。团队的第一步不是共享，而是先把每个人分清。

## 代价

代价是状态树更深、更新函数更多，读代码的人也更容易觉得“为什么一个同进程 worker 还要单独任务对象”。答案是：因为不单独建模就根本管不住。
