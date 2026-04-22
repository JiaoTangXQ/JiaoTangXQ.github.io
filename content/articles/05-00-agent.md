---
title: "面试题：为什么子 Agent 不是函数调用而是一个对象？"
slug: "05-00-agent"
date: 2026-04-09
topics: [任务与分派]
importance: 1.4
---

# 面试题：为什么子 Agent 不是函数调用而是一个对象？

假设你在设计 Claude Code 的多 Agent 框架。产品要求：用户可以同时开启多个子 Agent，每个 Agent 能在后台独立运行，用户可以随时查看进度，也可以切回前台，完成后主 Agent 收到通知。

你会怎么实现？

最直觉的回答是：`runAgent(prompt)` 返回一个 Promise，跑完了就告诉主会话结果。进度要显示就挂个临时变量，取消就保存一个 `AbortController`，完成通知就回调一下。

Claude Code 没走这条路。

## 它的答案：先建对象，再允许劳动

打开 `src/Task.ts`，第一件事不是定义怎么跑 Agent，而是定义任务的**类型系统和公共骨架**。

```typescript
export type TaskType =
  | 'local_bash'
  | 'local_agent'
  | 'remote_agent'
  | 'in_process_teammate'
  | 'local_workflow'
  | 'monitor_mcp'
  | 'dream'

export type TaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'killed'
```

然后是 `TaskStateBase`，7 个字段没有一个是"怎么执行"的字段，全是"怎么管理"的字段：

```typescript
export type TaskStateBase = {
  id: string
  type: TaskType
  status: TaskStatus
  description: string
  toolUseId?: string
  startTime: number
  endTime?: number
  totalPausedMs?: number
  outputFile: string
  outputOffset: number
  notified: boolean
}
```

`outputFile` 是输出路径，`outputOffset` 是已读取偏移，`notified` 是通知是否已发。这些都不是执行细节，是**治理字段**。

再往下是 `generateTaskId()`，不用 UUID，而是带类型前缀的随机 ID，细节后面会讲。

## 执行链：从骨架到血肉

整个多 Agent 架构是一条四层链路：

1. `Task.ts` — 定义公共骨架（类型、状态、ID、基础字段）
2. `src/utils/task/framework.ts` — 任务登记进 `AppState`，维护续读和驱逐
3. `src/tasks/LocalAgentTask/LocalAgentTask.tsx` — 为子 Agent 追加执行字段（`prompt`、`progress`、`pendingMessages`、`retain`、`evictAfter`）
4. `src/tools/AgentTool/AgentTool.tsx` — 决定任务是同步跑、后台跑、还是团队模式

顺序不是偶然的。先问"任务是什么"，再问"任务怎么跑"。这让系统在加入后台切换、消息注入、面板保留、批量 kill 等功能时，都能以同一个对象为中心操作，而不是每加一个功能就单独再存一套状态。

## 为什么不用函数调用

函数调用的问题不是"跑不起来"，而是"管不住"。

一个子 Agent 进入产品后，会遭遇一串现实问题：

- 用户能不能把它切到后台，继续干别的？
- 后台时输出写到哪里？写到内存还是磁盘？
- 主 Agent 怎么知道它完成了？怎么知道它失败了？
- 用户正在查看它的 transcript 时，能不能延迟回收？
- 上级 Agent 被 kill 时，子 Agent 能不能连带被 kill？

如果不先把 Agent 翻译成任务对象，这些问题就会散落在 UI 层、工具层、消息层、清理层，各自以补丁方式解决。补到最后，"会干活"和"能被管理"变成两个平行宇宙。

## 代价

这套结构的代价是前期更重。哪怕一个几秒钟就跑完的同步子 Agent，也得经历注册、状态更新、通知、驱逐这整套流程。`Task.ts`、框架层、具体任务实现之间需要长期保持一致，扩展新任务类型要先改"宪法"。

但 Claude Code 显然认为这笔成本值得付。它要的不是一堆碰巧跑完的后台动作，而是一个能被追踪、能被打断、能被恢复、还能被团队制度继续利用的工作台。

## 面试要点

被问到"如何设计多 Agent 框架"时，核心分水岭在于：**你是把 Agent 当执行者，还是当管理对象？**

执行者视角会先想 API 怎么调、结果怎么返回；管理对象视角会先想 ID 怎么生成、状态怎么流转、输出写在哪里、谁负责回收。

Claude Code 的答案是后者。任务对象不是执行完成后的产物，而是执行开始前就必须存在的前提。
