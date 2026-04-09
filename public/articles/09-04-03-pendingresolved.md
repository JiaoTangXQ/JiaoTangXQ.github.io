---
title: "pending 和 resolved 目录说明团队审批是可追踪流程，不是即时手势"
slug: "09-04-03-pendingresolved"
date: 2026-04-09
topics: [多Agent协作]
summary: "Claude Code 把团队权限请求落到磁盘目录里，说明它把审批当流程，而不是当一个瞬时点击。 `permissionSync.ts` 为每个团队创建 `permissions/pending` 和..."
importance: 1
---

# pending 和 resolved 目录说明团队审批是可追踪流程，不是即时手势

Claude Code 把团队权限请求落到磁盘目录里，说明它把审批当流程，而不是当一个瞬时点击。

## 实现链

`permissionSync.ts` 为每个团队创建 `permissions/pending` 和 `permissions/resolved` 目录。请求对象包含 worker 身份、工具名、输入、建议规则、状态、resolvedBy、resolvedAt 等字段，并通过锁文件写入。也就是说，一次权限请求不是弹窗里的一瞬间，而是一条可以被追踪的记录。

## 普通做法

普通做法会把审批留在内存里，用户一点击就结束，最多打一条日志。

## 为什么不用

Claude Code 不这样做，是因为团队里谁请求过什么、谁批的、有没有修改输入、有没有“总是允许”规则，这些都值得留痕。没有流程化记录，团队审批就只是一次手势，过后很难还原。

## 代价

代价是文件 I/O、锁管理、目录清理都得跟上，系统复杂度上升不少。但审批历史换来了可追踪性。
