---
title: "面试题：多开几个 AI Agent 算不算团队？Claude Code 怎么回答这个问题"
slug: "09-00-agent"
date: 2026-04-09
topics: [多Agent协作]
importance: 1.4
---

# 面试题：多开几个 AI Agent 算不算团队？Claude Code 怎么回答这个问题

假设面试官抛给你这道题：

> 你有一个 AI 编程助手，用户希望同时让多个 Agent 并行处理大型任务。设计这套多 Agent 协作系统。

大多数人会从并发讲起：线程池、任务队列、结果合并、负载均衡。这没有错，但 Claude Code 的答案从另一个维度切入——它先问的不是"怎么并发"，而是"多个 Agent 在一起算不算组织，如果是，组织需要什么"。

## 多开 agent 和团队的根本区别

看 `AgentTool.tsx` 里的一段判断逻辑：只有当调用方同时提供了 `team_name` 和 `name` 这两个参数，系统才走 teammate 生成路径。缺少任何一个，就是普通子 agent。

这个判断背后有一个架构主张：**团队是显式声明的，不是自然涌现的**。

更能说明问题的是这条限制：代码明确禁止 teammate 再生成 teammate。原因写在注释里：`TeamFile.members` 是扁平的成员名册，嵌套 teammate 会让归属关系混乱。一旦放开嵌套，谁该向谁汇报、谁的权限从哪里批，立刻没了答案。

多开 agent 只会多出并发执行器。团队需要的是：**身份、边界、通信规则、权限归宿、退场秩序**。

## Claude Code 团队系统的完整代码主干

理解这一卷，先把架构图建起来：

```
入口层
  AgentTool.tsx          — 区分普通子 agent 和 teammate，禁止 teammate 嵌套

执行层
  spawnInProcess.ts      — 同进程 teammate：AsyncLocalStorage 隔离
  PaneBackendExecutor.ts — pane teammate：tmux / iTerm2 独立终端

通信层
  teammateMailbox.ts     — 文件信箱：所有后端统一的消息通道

权限层
  inProcessRunner.ts     — 执行循环，处理权限请求上报
  leaderPermissionBridge.ts — 桥接非 React 执行层到 leader UI
  permissionSync.ts      — pending/resolved 目录，流程化权限审批

空间层
  backends/registry.ts   — 后端探测与缓存：in-process vs tmux vs iTerm2
  teammateLayoutManager.ts — pane 颜色分配，稳定身份记忆
```

任务系统解决"怎么把单个工作管住"，团队系统解决"怎么让多个劳动者像一个有秩序的组织那样工作"。两者都存在，职责不重叠。

## 普通多 agent 方案的问题在哪

最直觉的做法：多开几个 agent 实例，共享一个任务列表，谁空了谁拿任务，结果写回共享内存，leader 最后汇总。

这能快速跑出"多个 AI 并行工作"的效果。但它回答不了几个关键问题：

1. **用户该和谁说话？** 5 个 agent 都能输出，用户面对的是群聊噪音还是单一接口？
2. **权限谁来批？** Agent A 要执行命令，弹窗给用户。Agent B 也要，再弹一个。用户看到 5 个弹窗同时出现。
3. **谁能代表团队决策？** agent 之间意见不一致时，没有仲裁点。
4. **怎么优雅退出？** 任务完成后，各个 agent 怎么知道自己该停了？靠轮询还是通知？

这些问题不是技术性能问题，而是**组织制度问题**。Claude Code 的回答是：不建制度，就别谈团队。

## 代价与取舍

引入这套制度，复杂度会明显上升。你会看到 mailbox 的锁机制、leader 权限桥、backend registry 的缓存逻辑、颜色分配的生命周期、permissionSync 的 pending/resolved 目录——每一样都在回答一个"多 agent 不能回避的协作问题"。

相比"多开几个 agent"，理解成本高得多。但这也正是它能在混乱的并发场景里维持团队秩序的原因。

小白可以把这理解成：多招几个人不等于公司成立。公司成立还需要前台、部门、审批流程、汇报关系和离职手续。Claude Code 的团队系统，就是 AI Agent 世界里的这套公司制度。

## 面试怎么答

如果面试题是"设计多 Agent 协作系统"：

**及格答案**：讲任务队列、并发控制、结果合并。展示你理解并发编程。

**优秀答案**：在并发之上，额外考虑：身份隔离（谁是谁）、通信显式化（不能靠共享内存）、权限集中（用户不能被多弹窗轰炸）、优雅退出（怎么让所有成员有序结束）。

**满分答案**：能讲清楚"组织制度层"和"执行并发层"的分工——任务系统解决劳动闭环，团队系统解决组织秩序，两者都需要，但不应该混在一起设计。再加上：为什么通信层选择文件而不是 Redis（部署约束），为什么后端探测要缓存（稳态优先于动态自适应），为什么 leader 要统一承接权限（用户体验而不是权力集中）。

这道题考的核心是：**你能不能在"加几个并发线程"的表象之下，看到真正让多 agent 系统稳定工作所需要的组织基础设施**。
