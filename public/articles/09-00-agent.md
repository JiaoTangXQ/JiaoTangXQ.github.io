---
title: "第九卷导读：团队不是多开几个 agent，而是先长出秩序"
slug: "09-00-agent"
date: 2026-04-09
topics: [多Agent协作]
summary: "这一卷讲的不是“Claude Code 能不能同时跑多个 agent”，而是“为什么多个 agent 不会自动变成团队”。任务系统解决的是劳动闭环，团队系统解决的是身份、通信、审批、空间和退场秩序。 ..."
importance: 1.4
---

# 第九卷导读：团队不是多开几个 agent，而是先长出秩序

这一卷讲的不是“Claude Code 能不能同时跑多个 agent”，而是“为什么多个 agent 不会自动变成团队”。任务系统解决的是劳动闭环，团队系统解决的是身份、通信、审批、空间和退场秩序。

## 实现链

团队模式的代码主干分成几层。入口在 `src/tools/AgentTool/AgentTool.tsx`，它区分普通子 agent 和 teammate，并禁止 teammate 再生 teammate。执行层分成两类：`src/utils/swarm/spawnInProcess.ts` 负责同进程 teammate，`src/utils/swarm/backends/PaneBackendExecutor.ts` 负责 tmux/iTerm2 pane teammate。通信统一走 `src/utils/teammateMailbox.ts`。权限协调靠 `src/utils/swarm/inProcessRunner.ts`、`leaderPermissionBridge.ts` 和 `permissionSync.ts`。布局和后端选择则在 `src/utils/swarm/backends/registry.ts` 与 `teammateLayoutManager.ts`。

这说明 Claude Code 眼里的“团队”不是多几个执行器，而是一整层制度。

## 普通做法

业内更容易想到的多 agent 方案，是多开几个线程、协程或进程，让它们共享一点内存，最后把结果汇总。通信靠共享状态，审批靠各自弹窗，界面只是把更多日志堆上来。

这样做能很快做出“多个 AI 同时工作”的效果。

## 为什么不用

Claude Code 没这么做，是因为它关心的不只是并发，而是组织秩序。用户到底面对谁，worker 之间怎么发话，权限由谁统一承接，后端不同时如何保持同一团队语义，这些都不是线程数量能解决的。

所以它给团队单独长出一层运行时。小白可以把这理解成：多开几个员工不等于公司成立，公司成立还要有前台、流程、信箱和审批制度。

## 代价

代价是系统会明显更重。你会看到 mailbox、leader bridge、backend registry、颜色分配、pane 布局、权限同步全都冒出来。相比“多开几个 agent”，理解成本高得多；但这也正是它能稳住团队秩序的原因。
