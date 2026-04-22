---
title: "对比分析：GitHub Copilot 的工具调用和 Claude Code 的子 agent，为什么最终走向不同架构？"
slug: "01-03-06-agentagent"
date: 2026-04-09
topics: [工作台架构]
importance: 1
---

# 对比分析：GitHub Copilot 的工具调用和 Claude Code 的子 agent，为什么最终走向不同架构？

## Copilot Workspace 式的架构：一次完整的规划-执行循环

GitHub Copilot Workspace 的设计思路相对直接：用户描述一个任务，系统生成一个执行计划，用户确认后，AI 按计划执行一系列操作，完成后呈现结果。整个过程是线性的、同步等待的，用户看到的是一个从头到尾的单次工作流。

如果用类比来说，这更像是"发一封邮件，等对方完成后回信告诉你结果"。

## Claude Code 的子 agent：三重身份同时存在

Claude Code 的子 agent 要复杂得多。当主 agent 调用 `AgentTool` 时，发生了三件同时进行的事情：

**第一重身份：工具调用**

从模型的视角看，调用 `AgentTool` 就是调用一个工具。它有 Zod 定义的 `inputSchema`，有 `validateInput`，有权限检查，有 `ToolResult` 返回值。模型调用它的语法和调用 `BashTool` 完全一样——这是一个关键的设计决策，它让模型不需要理解"子 agent"这个概念，只需要知道"有一个工具叫 AgentTool，我用它来委派子任务"。

**第二重身份：登记在案的任务**

`AgentTool.call()` 内部会调用 `generateTaskId('local_agent')`，产生一个 `a` 开头的任务 ID，然后通过 `createTaskStateBase` 和 `registerTask` 把这个任务写进 `AppState.tasks`。从这一刻起，子 agent 有了 `outputFile`、`outputOffset`、`status: 'pending'`，界面底部的状态栏会显示它，用户可以按 `Shift+Down` 查看正在运行的后台任务列表，可以手动 kill 它。

**第三重身份：独立的 agent 实例**

子 agent 会拿到自己的提示词上下文、工具集（可能是主 agent 工具集的子集或限制版本）、独立的会话消息列表。它可以有自己的 `agentId`（类型是 `AgentId`），用于 hooks 系统区分"这次工具调用来自子 agent 还是主线程"。在团队协作场景下，不同子 agent 可以有不同的"团队身份"。

## 为什么不能只保留其中一重

少一重身份的代价是具体的。

**如果只把子 agent 当工具：** 工具调用是同步等待的——主 agent 调用 `BashTool`，等 bash 进程返回，然后继续。如果子 agent 是一个可能跑几分钟的复杂任务，这意味着主 agent 整个挂起等待，不能响应用户交互，不能被中断，不能展示进度。工具调用的内存也是线性的——调用结束后，中间产生的所有消息都消失，只有 `ToolResult` 留下来。子 agent 的工作历史无法被回溯。

**如果只把子 agent 当任务：** 任务系统负责生命周期管理（pending → running → completed/failed/killed），但不解决"模型如何发起委派"的问题。任务需要被某个执行者创建——如果不通过工具调用，就需要设计另一套从模型到任务系统的通信协议，而这套协议本质上和工具调用要解决的问题一样。

**如果只把子 agent 当独立 agent：** 一个自由浮动的 agent 实例无法被主系统管理。它不出现在 AppState 里，用户不知道有什么东西在后台跑，无法 kill，无法查看进度，无法限制预算。这正是很多早期 agent 框架的问题——"多 agent"成了黑箱效果，而不是可治理的工程能力。

## 这个设计带来的实际能力

这三重身份叠加，让 Claude Code 的子 agent 支持一些单一架构做不到的事情：

**前后台切换：** 子 agent 可以被"后台化"（`isBackgrounded: true`），主 agent 继续处理其他任务，稍后再"接管"子 agent。`isBackgroundTask` 函数判断的正是这个状态。

**进度可见：** 由于有 `outputFile`，UI 可以实时流式显示子 agent 的输出，不需要等它完成。

**预算约束：** 子 agent 的工具调用同样受 `maxBudgetUsd` 约束，可以设置独立的消费上限。

**hooks 区分：** `ToolUseContext` 里的 `agentId` 字段让 PreToolUse/PostToolUse hooks 知道当前调用来自哪个 agent 实例，可以针对子 agent 应用不同的规则。

## 面试角度

**这道题的考法**：问"Claude Code 里的子 agent 和普通工具调用有什么区别"，或者"如果你来设计多 agent 框架，子 agent 应该是工具、任务还是独立进程"。

**满分答法**：说清楚三重身份分别解决了什么问题——工具接口解决了"模型如何发起委派"、任务登记解决了"系统如何追踪和管理"、独立 agent 状态解决了"委派的工作如何有自己的上下文"。然后举出少任何一重的具体代价。

**容易混淆的地方**：子 agent 的"工具调用"身份是**从模型视角**的抽象，任务登记是**从系统视角**的实现，两者不互相排斥。很多人会说"它是工具调用还是任务？"，正确答案是"同时是两个，因为它们回答的是不同层面的问题"。
