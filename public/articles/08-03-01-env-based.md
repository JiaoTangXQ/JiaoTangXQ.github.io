---
title: "env-based保留的是一整层环境分发世界"
slug: "08-03-01-env-based"
date: 2026-04-09
topics: [远端与边界]
summary: "- `initReplBridge.ts` 在 env-based 路径里会先拿到 `orgUUID`、环境信息，再让 `replBridge.ts` 走 `createSession()` 时带上 ..."
importance: 1
---

# env-based保留的是一整层环境分发世界

## 实现链
- `initReplBridge.ts` 在 env-based 路径里会先拿到 `orgUUID`、环境信息，再让 `replBridge.ts` 走 `createSession()` 时带上 `environment_id`。这意味着远端不是一个抽象云端，而是某个组织下、某个可选环境里的具体工作位。
- 代码还会读取设置中的默认环境来源，说明环境分发本身就是产品制度的一部分，不是桥接层随手附带的参数。

## 普通做法
- 更普通的远端方案会预设一个固定执行环境，用户不需要知道环境选择这层。
- 那样路径更短，也更像传统托管终端。

## 为什么不用
- Claude Code 没把环境层藏掉，是因为它面对的是组织、策略和多环境现实。环境不同，权限、仓库来源、可复用 outcome 都可能不同。
- 如果桥接层跳过这一层，系统就没法解释“为什么这次远端会话在那个环境里，而不是另一个里”。

## 代价
- 代价是远端启动前要多做一轮环境选择和设置合并，用户也得理解环境不只是主机名。
- 但这让远端世界更接近真实托管平台，而不是一台单机 SSH 盒子。
