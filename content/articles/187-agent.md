---
title: "同步子 Agent 为什么也要先注册成任务：对象身份先于执行姿态"
slug: "187-agent"
date: 2026-04-09
topics: [Agent, 任务系统, Claude Code 内核]
importance: 0.9
---

# 同步子 Agent 为什么也要先注册成任务：对象身份先于执行姿态

面试题版本：**"Claude Code 里同步子 agent 的执行也要先创建 Task 对象注册到 AppState，而不是直接调用然后等待返回。这个注册步骤的意义是什么？它解决了什么如果不注册就会出现的问题？"**

## 直接调用 vs 注册后调用

假设你要在当前会话里同步跑一个子 agent 来处理一个子任务：

**方案 A：直接调用，等返回**
```typescript
// 看起来简单
const result = await runSubAgent(subtask)
// 处理 result
```

**方案 B：注册任务，再执行**
```typescript
// Claude Code 实际做的
const taskState = createTaskState({
  type: 'local_agent',
  status: 'running',
  description: subtask.description,
  startTime: Date.now(),
  outputFile: getTaskOutputPath('local_agent', taskId),
  outputOffset: 0,
  notified: false,
})
setAppState(s => addTask(s, taskState))
const result = await runSubAgent(subtask, taskState)
```

在同步执行的场景下，方案 A 看起来完全够用：你等结果，拿到了就继续。为什么 Claude Code 要走方案 B？

## 问题一：并发时系统需要看见"现在有什么在运行"

Claude Code 允许多个工具并发执行（通过 `StreamingToolExecutor`）。当主 agent 在等子 agent 的同时，用户界面需要显示"当前有哪些任务在运行"。

如果子 agent 不注册到 AppState，界面只能看到主 agent 在跑，看不到子 agent 的进度。用户会看到一段时间没有反应，不知道系统在做什么。

注册后，任务列表里出现新条目，进度条更新，用户知道工作在推进。

## 问题二：中断需要统一的取消路径

如果用户按下中断键（Ctrl+C 或 ESC），系统需要取消当前所有运行中的工作。

如果子 agent 只是一个普通的 `await Promise`，中断逻辑需要额外追踪"有没有子 agent 在跑、它的 AbortController 在哪里"。每种子任务类型都要有自己的中断追踪逻辑，代码迅速变得复杂。

注册后，所有任务都在 AppState.tasks 里，`Task.kill()` 接口提供统一的取消入口，中断逻辑只需要遍历任务列表，不需要知道任务是同步的还是异步的。

## 问题三：对象身份在日志和调试里的价值

子 agent 执行时会产生日志、工具调用记录、输出内容。这些记录都需要关联到某个可追踪的 ID。

没有任务对象时，这些记录只能和父会话或父工具绑定，无法独立追踪子 agent 的执行历史。出问题时，日志里只能看到"父 agent 调用了某个工具，工具执行了很久"，看不到子 agent 里具体发生了什么。

任务 ID 的存在让每次子 agent 执行都有独立的追踪链，可以从任意入口追溯完整的执行历史。

## "系统先认对象，再认姿态"的含义

这句话翻译成工程语言：**TaskState 对象的创建早于执行方式的确定**。

一个任务可以是：
- 同步等待（`local_agent`，当前会话里直接跑）
- 后台执行（`remote_agent`，放到后台继续）
- 被暂停（用户切走了，任务挂起）

这三种姿态只是同一个任务的不同运行状态，不是三种不同的任务类型。因为任务对象先于姿态存在，从同步切到后台时，不需要"创建一个新任务然后迁移状态"，只需要把 TaskState.status 改掉，把 `backgrounded` 或类似字段更新。

这也是为什么 `TaskType` 里的类型（`local_agent`、`remote_agent`、`dream` 等）描述的是执行机制，而不是同步/异步——执行机制是固定的，姿态（前台/后台）是可变的。

## 面试角度的总结

注册子 agent 为任务对象的价值在于：**可见性、可中断性、可追踪性**，这三件事都需要稳定的对象身份。同步执行只是执行姿态的一种，它不能成为跳过注册的理由。反过来说，如果每种执行姿态都自己管理自己的状态，系统就需要针对每种姿态都实现一遍可见性、中断和追踪逻辑，代码量翻倍，逻辑也更脆。统一在任务对象里，额外的注册开销换来了一致的系统视图。
