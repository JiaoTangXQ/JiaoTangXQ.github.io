---
title: "Claude Code utils 分簇地图"
slug: "014-utils"
date: 2026-04-09
topics: [参考]
summary: "`utils/` 大不是因为“杂”，而是因为 Claude Code 把大量真实世界边界条件都收进了底座。 `utils` 至少可以分成几簇： - 执行与任务：`utils/task/*`、`abor..."
importance: 0.9
---

# Claude Code utils 分簇地图

`utils/` 大不是因为“杂”，而是因为 Claude Code 把大量真实世界边界条件都收进了底座。

## 实现链

`utils` 至少可以分成几簇：

- 执行与任务：`utils/task/*`、`abortController`、`cleanupRegistry`
- 权限与规则：`utils/permissions/*`
- 会话与连续性：`sessionStorage`、`fileStateCache`、`queryContext`
- 团队与通信：`utils/swarm/*`、`teammateMailbox.ts`
- 模型与策略：`utils/model/*`、`thinking`、`fastMode`
- 系统边界：`cwd`、`Shell`、`envUtils`、`platform`

## 普通做法

普通项目常把 `utils` 看成杂物间，什么放不下都往里塞。

## 为什么不用

Claude Code 的 `utils` 不完全是杂物间。很多模块其实是运行时底座，因为它们在处理模型之外的真实世界约束：文件系统、权限、进程、团队通信、持久化、环境探测。这些东西没法塞进单一业务层，只能在底座处收编。

## 代价

代价是 `utils/` 很容易吓人，看起来像一片大森林。读代码时必须按职责分簇，而不能把它当成无结构区域。
