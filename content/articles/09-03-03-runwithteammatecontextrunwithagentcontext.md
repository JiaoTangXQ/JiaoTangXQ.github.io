---
title: "runWithTeammateContext 再套 runWithAgentContext，说明同进程隔离是双层外壳"
slug: "09-03-03-runwithteammatecontextrunwithagentcontext"
date: 2026-04-09
topics: [多Agent协作]
summary: "Claude Code 给同进程 teammate 套了两层壳，说明它区分“团队身份”和“agent 调用身份”。 `runWithTeammateContext()` 负责提供 teammate 级..."
importance: 1
---

# runWithTeammateContext 再套 runWithAgentContext，说明同进程隔离是双层外壳

Claude Code 给同进程 teammate 套了两层壳，说明它区分“团队身份”和“agent 调用身份”。

## 实现链

`runWithTeammateContext()` 负责提供 teammate 级别的信息，如 `agentName`、`teamName`、颜色和父会话。`runWithAgentContext()` 负责分析、日志和调用归因，告诉系统这次执行属于哪类 agent。两层一起用，表示一个同进程 teammate 同时活在两个维度里：它既是团队成员，也是一次具体 agent 执行。

## 普通做法

普通做法一般只套一层上下文，能传身份就够了。

## 为什么不用

Claude Code 不想把这两个维度揉成一个，是因为揉在一起后，很多判断就说不清了。团队路由需要的是“你是哪位队友”，分析和工具归因需要的是“你现在以什么 agent 身份执行”。两者相关，但不是同一件事。

## 代价

代价是上下文传播更复杂，任何漏传或越界都更难排查。但这也让系统在调试和分析上更清楚。
