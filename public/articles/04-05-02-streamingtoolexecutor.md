---
title: "为什么 Claude Code 不用 Promise.all 并发执行工具，而是自己造了一个四状态调度器？"
slug: "04-05-02-streamingtoolexecutor"
date: 2026-04-09
topics: [主循环]
importance: 1
---

# 为什么 Claude Code 不用 Promise.all 并发执行工具，而是自己造了一个四状态调度器？

面试官经常问："给你一组异步任务，有些可以并行，有些必须串行，怎么调度？" 大部分人会回答 Promise.all 加条件判断。但如果面试官追问三个约束——并行执行、有序返回、实时进度——你会发现 Promise.all 根本撑不住。

Claude Code 的 `StreamingToolExecutor` 就是这道题的生产级答案。

## 核心矛盾：三个需求互相打架

先看需求：

1. **并行执行**——读文件和搜索代码没有依赖关系，同时跑能省一半时间
2. **有序返回**——模型和用户看到的结果顺序必须和工具请求顺序一致，否则 transcript 会乱
3. **实时进度**——Bash 命令跑 30 秒，用户不能等 30 秒才看到第一行输出

Promise.all 能做到第一点，但它返回时要么全部完成要么全部失败，没有"部分完成按顺序吐"的能力。Promise.race 能做到实时响应，但它不保证顺序。把两者组合起来？代码会变成一坨难以维护的 Promise 编排。

Claude Code 的做法是：不用 Promise 原语编排，而是自己维护一张状态表。

## 四状态机：queued → executing → completed → yielded

每个被模型调用的工具，在 StreamingToolExecutor 内部被包装成一个 `TrackedTool`：

```
┌─────────────────────────────────────────────────┐
│                  TrackedTool                     │
├──────────┬──────────────────────────────────────┤
│ id       │ 工具调用的唯一标识                      │
│ block    │ 模型返回的 ToolUseBlock                │
│ status   │ queued → executing → completed → yielded │
│ isConcurrencySafe │ 这个工具能否和别人并行？       │
│ pendingProgress   │ 实时进度消息的缓冲区           │
│ results  │ 最终执行结果                            │
│ contextModifiers  │ 执行后对上下文的修改函数        │
└──────────┴──────────────────────────────────────┘
```

状态流转：

```
     addTool()          processQueue()        getCompletedResults()
        │                    │                        │
        ▼                    ▼                        ▼
    ┌────────┐  canExecute?  ┌───────────┐  done?  ┌─────────┐
    │ queued │──── yes ──────│ executing │── yes ──│completed│──── yield ────→ yielded
    │        │               │           │         │         │
    │        │◄── no ────────│           │         │         │
    └────────┘  (等待)        └───────────┘         └─────────┘
                                   │
                                   │ pendingProgress
                                   ▼
                              (立即 yield 给 UI，不等完成)
```

关键在于 `canExecuteTool()` 的判断逻辑只有 4 行，但信息密度极高：

```
canExecute(isConcurrencySafe):
  正在执行的工具数 === 0  →  当然可以
  新工具是并发安全的 AND 所有正在执行的也是并发安全的  →  可以
  否则  →  排队等待
```

这意味着：Read + Grep + Glob 可以同时跑（都是并发安全的），但一旦队列里出现 Bash 或 Write，整个队列暂停，等它独占执行完再继续。这不是简单的"串行 vs 并行"二选一，而是一个**动态的互斥锁**，粒度到单个工具级别。

## processQueue 的队列扫描策略

`processQueue()` 遍历工具数组时有一个微妙的分支：

```
for each tool in queue:
  if tool.status !== 'queued': 跳过
  if canExecuteTool(tool.isConcurrencySafe): 启动执行
  else if !tool.isConcurrencySafe: break  ← 关键！
```

为什么遇到不能执行的非并发安全工具要 break 而不是 continue？

因为**非并发安全工具之间有隐式的顺序依赖**。假设队列是 `[Write A, Read B, Write C]`，Write A 正在执行。如果用 continue 跳过 Write C 去启动 Read B，那 Read B 可能读到 Write A 的中间状态，而 Write C 最终覆盖了 Write A 的结果——顺序语义被破坏了。

用 break 意味着：一旦遇到一个必须等待的非并发安全工具，后面的所有工具都不启动，即使后面有可以并行的只读工具。这是牺牲了一点并发性来换取**绝对的顺序安全**。

## 有序返回的秘密：getCompletedResults 的 FIFO 扫描

`getCompletedResults()` 是一个同步生成器，它按数组顺序遍历所有工具：

```
for each tool (按添加顺序):
  1. 先把 pendingProgress 全部 yield 出去（不管工具状态如何）
  2. 如果 status === completed：标记 yielded，yield 所有 results
  3. 如果 status === executing 且不是并发安全的：break
```

第 3 步是关键：如果一个非并发安全工具还在执行，后面的工具即使已经完成了也不会被 yield。这保证了**结果顺序和请求顺序严格一致**。

但 pendingProgress 不受这个限制——进度消息永远立即 yield，哪怕工具还没完成。这就是为什么你能在终端里实时看到 Bash 命令的输出，同时最终结果仍然是有序的。

## Bash 的特殊待遇：兄弟中止控制器

StreamingToolExecutor 构造时创建了一个 `siblingAbortController`，它是 `toolUseContext.abortController` 的子控制器。每个工具执行时，又从 siblingAbortController 创建自己的子控制器：

```
                  toolUseContext.abortController  (query 级)
                              │
                   siblingAbortController  (本轮工具级)
                    ╱         │          ╲
            tool-1 ctrl   tool-2 ctrl   tool-3 ctrl
```

当 Bash 工具报错时，系统做了一件独特的事：只中止 siblingAbortController，不中止父级的 query controller。效果是：**同一轮的其他工具被取消，但整个会话继续运行**。

为什么只有 Bash 触发这个逻辑？源码注释说得很直白：Bash 命令之间经常有隐式依赖链（mkdir 失败了，后面的 cd 和 write 都没意义），而 Read、WebFetch 这类工具是独立的，一个失败不应该连累其他的。

但反过来，如果是权限对话被用户取消（不是工具执行出错），per-tool 的中止信号会冒泡到 query controller，因为这意味着**用户主动拒绝了整个操作意图**，不只是这一个工具。

这个三层中止控制器的设计，在面试中可以展开讲很久——它本质上是一个**分级熔断机制**：工具级错误只熔断兄弟，用户级拒绝熔断整个 query。

## 面试怎么答这道题

如果面试官问"设计一个并发工具执行器"，大部分候选人会直奔 Promise.all + 互斥锁。这能拿到及格分，但缺少三个关键洞察：

**第一，并发控制不是全局锁，而是动态互斥。** 不是"要么全并行要么全串行"，而是根据每个工具的 isConcurrencySafe 属性动态决定。正确答案是维护一个状态表，在队列扫描时实时判断。

**第二，有序返回需要一个独立的 yield 机制。** Promise.all 返回的是全部完成后的数组，无法做到"前面的完成了先吐，后面的等着"。正确做法是用生成器（Generator）按顺序扫描，遇到未完成的 blocking 工具就 break。

**第三，进度和结果要走不同的通道。** 进度消息是"尽力而为"的实时流，不需要等工具完成就能吐给 UI。结果消息是"严格有序"的最终产物，必须按顺序 yield。两者的语义不同，通道也应该不同。StreamingToolExecutor 用 pendingProgress 数组做了这个分离。

最后一个加分点：**错误传播的粒度**。Promise.all 的 fast-fail 是全局的——一个失败全部失败。生产系统需要更细的粒度：Bash 失败取消兄弟但不取消 query，权限拒绝取消整个 query。这需要一个分层的 AbortController 树，每一层的中止语义不同。

这道题之所以难，不是因为单个技术点复杂，而是因为它要求你同时考虑并发性、有序性、实时性和错误传播四个维度。能把这四个维度讲清楚并给出分层方案的候选人，在系统设计面试中通常能拿到 strong hire。
