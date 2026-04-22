---
title: "任务系统管劳动闭环，Swarm 管组织秩序：为什么不能混"
slug: "204-swarm"
date: 2026-04-09
topics: [Swarm, 任务系统, 多Agent]
importance: 0.9
---

# 任务系统管劳动闭环，Swarm 管组织秩序：为什么不能混

面试题版本：**"Claude Code 里 TaskCreateTool 和 AgentTool（swarm 模式）的职责边界在哪里？一个复杂的多步骤任务，应该用 TaskCreateTool 创建多个任务，还是用 AgentTool 创建多个 agent？判断标准是什么？"**

## 任务系统的边界

`TaskCreateTool`（`src/tools/TaskCreateTool/`）的职责是：

**创建一个有完整生命周期的工作单元**。这个工作单元有：
- 唯一 ID（可追踪）
- 输出文件（结果可持久化）
- 状态转换（pending → running → completed/failed）
- 通知机制（完成时通知调用方）
- 中断处理（可以被取消）

任务系统解决的是"单个工作单元从开始到结束的完整管理"。它不关心这个任务和其他任务是什么关系，只关心自己的生命周期。

## Swarm/AgentTool 的边界

`AgentTool`（`src/tools/AgentTool/`）的职责是：

**组织多个 agent 的协作关系**。这包括：
- 定义子 agent 的角色和能力边界（给哪些工具）
- 表达子 agent 之间的依赖关系（agent B 需要等 agent A 完成）
- 聚合多个子 agent 的结果
- 处理子 agent 失败时的恢复逻辑

AgentTool 本身也会用任务系统来管理子 agent（每个子 agent 是一个 `local_agent` 类型的任务），但它的核心价值是**组织层面的协调**，而不是单个任务的生命周期管理。

## 判断用哪个的标准

**用 TaskCreateTool 的场景**：
- 后台运行一个 bash 脚本
- 异步执行一个文件处理任务
- 启动一个长时间运行的监控进程
- 任务是自包含的，不需要和其他任务协调

**用 AgentTool（swarm）的场景**：
- 任务需要被分解成多个有依赖关系的子任务
- 不同子任务需要不同的工具权限（安全边界分隔）
- 需要并行加速但结果需要整合
- 子任务的执行策略需要动态调整（某个方向探索失败，尝试另一个方向）

一个实际例子：

**场景**：分析一个代码库，找出所有性能瓶颈，并提出优化建议。

- 用 **TaskCreateTool** 的子问题：读取文件、运行分析脚本、写入结果报告——这些是独立的工作单元
- 用 **AgentTool** 的子问题：前端性能 agent、后端性能 agent、数据库 agent 并行工作，结果整合成统一报告——这是组织协调问题

## 为什么混淆会有问题

如果用任务系统来做组织协调：

```typescript
// 错误方向：用任务系统试图表达组织关系
const task1 = await createTask({ description: "分析前端" })
const task2 = await createTask({ description: "分析后端", dependsOn: task1 }) // 这个接口不存在
```

任务系统没有"dependsOn"这样的依赖声明接口，因为它不是任务系统的职责。如果要用任务系统表达依赖，要么在任务代码里硬编码（在 task2 的代码里等待 task1 完成），要么在外部维护一个依赖图——这就在不恰当的层实现了 swarm 的职责。

如果用 AgentTool 来做简单的后台任务：

```typescript
// 过度设计：用 swarm 运行一个简单 bash 脚本
const agent = await createAgent({
  description: "运行 build 脚本",
  // 为了一个简单 bash 命令创建了整个 agent 上下文
})
```

这带来了不必要的开销：agent 有更大的状态对象、更复杂的初始化、更重的监控机制，对于一个不需要动态决策的 bash 命令来说是过度设计。

## 分层习惯先于技巧

"分层习惯先于技巧"这个原则在这里的含义：

在设计具体功能之前，先弄清楚这个功能属于哪一层的问题。任务生命周期管理是一层，多 agent 组织协调是另一层。搞清楚层次，再选择合适的工具。

如果层次不清，就会出现"聪明但危险"的解决方案：用技巧硬撑，比如用任务系统的钩子实现隐式的 agent 协调，短期可以工作，但随着复杂度增加，这些隐式协调会变成难以追踪的 bug 来源。

## 面试角度的总结

TaskCreateTool 和 AgentTool 的边界是：前者管单个工作单元的完整生命周期，后者管多个工作单元的组织关系。判断标准不是技术上能不能用（两者技术上都能组合实现很多东西），而是语义上哪个更准确——这件事是"一个需要管理生命周期的工作单元"，还是"多个需要协调组织的工作者"。
