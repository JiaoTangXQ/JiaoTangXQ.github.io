---
title: "leader UI：团队里的主导界面为什么是收口混乱，而不是收走权力"
slug: "151-leader-ui"
date: 2026-04-09
topics: [团队协作, 权限系统, UI设计]
summary: "在 Claude Code 的多 agent 团队模式里，leader agent 有一个专属的 UI 状态。这个 leader UI 不是用来给 leader 更多权力的，而是用来在有多个 agent 同时工作时，把混乱的权限请求和决策归口到一处。这个设计解决了什么具体问题？"
importance: 0.9
---

# 深度分析：团队 leader 的 UI 职责是协调，不是控制

## 多 agent 团队里的权限混乱问题

想象这样的场景：

你让 Claude Code 起了一个 5 人团队：1 个 leader agent 协调整体，4 个 worker agent 分别处理不同的子任务。

所有 worker 在工作过程中都会遇到需要权限审批的操作（比如修改某个重要文件、执行某个 bash 命令）。

如果没有协调机制：5 个 agent 都可以向用户弹出权限请求。用户面对 5 个来自不同 agent 的权限请求窗口，不知道每个请求的上下文，也不知道批准某个请求是否会影响其他 agent 的工作。

这不是"更多功能"的代价，而是多 agent 协作的本质困难：**用户交互点的数量随 agent 数量线性增长，但用户的注意力不会增长**。

## permissionSync.ts 的设计

在 `src/utils/swarm/permissionSync.ts` 里，有详细的注释描述了权限同步机制：

```
Flow:
1. Worker agent 遇到权限请求
2. Worker 发送 permission_request 消息到 leader 的邮箱
3. Leader 轮询邮箱，检测到权限请求
4. 用户通过 leader 的 UI 审批或拒绝
5. Leader 发送 permission_response 到 worker 的邮箱
6. Worker 轮询邮箱获取响应，继续执行
```

这个机制的核心是：**所有权限决策都通过 leader 的 UI 呈现给用户，用户只需要和一个界面交互**。

worker 不直接弹出权限请求，它把请求发给 leader，等待 leader（代表用户）回复。

## leader UI 是什么，不是什么

**leader UI 是**：

- 用户和整个团队交互的单一接触点
- 所有 worker 权限请求的聚合展示界面
- 团队整体状态的控制面板（可以看到所有 worker 的进度）

**leader UI 不是**：

- leader 拥有比 worker 更高权限的标志
- 用于隐藏 worker 行为的中间层
- 所有决策必须由 leader 做出的命令体系

关键区别在于：leader 在权限流程里是"代理用户做决定"的角色，而不是"替代用户做决定"的角色。用户仍然是权限决策的最终主体，leader UI 只是把这些决策统一展示给用户。

## cli/print.ts 里的 UI 识别

`cli/print.ts` 里有处理"哪个 agent 的输出展示给用户"的逻辑。

在非团队模式下，只有一个 agent，所有输出直接展示。

在团队模式下，需要区分：
- leader 的输出：展示给用户，因为这是团队的"代言人"
- worker 的输出：默认不展示给用户（避免信息过载），但在 leader 的任务面板里可以看到各 worker 的进度

这个展示策略是 leader UI 的另一面：**不是隐藏 worker 的工作，而是把用户的注意力集中在最重要的信息上**。

## 和共享内存式协作的对比

最直觉的多 agent 实现是共享内存：所有 agent 都能读写一个共享的状态树，worker 完成了就更新共享状态，leader 和用户通过读共享状态了解进展。

这种方式的问题：

**人插不进去**：权限请求在哪里展示？共享状态里的任何变化都可能需要权限，但没有自然的"收口"把这些请求展示给用户。

**状态恢复不了**：某个 worker 崩溃了，共享状态里可能有残留的、不完整的更新。恢复时很难判断哪些更新是完整的、哪些是部分写入的。

leader UI + 邮箱通信模式解决了这两个问题：权限请求有明确的收口（leader UI），状态恢复有明确的起点（读取邮箱里的未处理消息）。

## 面试要点

1. **leader UI 是权限请求的聚合点**：所有 worker 的权限请求通过 permissionSync 路由到 leader 展示，用户只需要和一个界面交互。
2. **leader 代理用户决策，而不是替代用户决策**：最终决策权仍然在用户，leader 只是展示渠道。
3. **展示策略是注意力管理**：leader 输出给用户看，worker 输出在后台面板里，这不是隐藏而是减少信息噪音。
4. **相比共享内存，邮箱+leader 模式有更好的恢复性**：每条消息都有记录，恢复时有明确的状态重建起点。
