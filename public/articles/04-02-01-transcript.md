---
title: "为什么先写 transcript 再调 API，而不是调完 API 再写？"
slug: "04-02-01-transcript"
date: 2026-04-09
topics: [主循环]
importance: 1
---

# 为什么先写 transcript 再调 API，而不是调完 API 再写？

面试里有一类题叫"顺序就是设计"——两行代码换个先后，系统的行为保证就会不同。`QueryEngine.submitMessage()` 里有一处这样的顺序，值得仔细看。

## 代码顺序

`submitMessage()` 的执行顺序大致是：

```
1. processUserInput()      // 整理用户输入、附件、slash 命令
2. recordTranscript(messages)   // ← 先写盘
3. for await (const message of query(...))  // ← 再调 API
```

注意步骤 2 在步骤 3 之前。这不是笔误，不是历史遗留，源码注释里明确写了原因：

> If the user message has been accepted but we crash before hitting the API, we want to make sure the message is in the transcript so we can resume.

意思是：用户消息一旦被系统接受，就必须立刻可被 `--resume` 找回，不等 API 有没有成功返回。

## 为什么"等 API 成功再写"会有问题？

想象一个典型的崩溃场景：

```
用户发出: "帮我重构这个函数"
系统：接受消息 ✓
系统：准备调 API...
系统：[进程崩溃]
```

如果是"等 API 成功再写"的方案：
- transcript 里没有用户消息
- 用户运行 `--resume` 后，系统看到的最后状态是上一轮对话结束
- 用户需要重新输入"帮我重构这个函数"
- 更糟的情况：用户不知道消息没被保存，以为 Claude 看到了但忽略了

如果是"先写再调"的方案：
- transcript 里有用户消息
- `--resume` 后，系统看到这条消息，知道需要继续处理
- 用户得到的是连续的会话体验

## 这背后的工程哲学

这道题背后有一个更有意思的工程问题：**"什么时候算作一个事件已经发生？"**

常见的答案是：等副作用（API 调用）成功，才算发生。这很直觉。

但 Claude Code 用的是另一种答案：**用户意图被系统接受**，就算一个已经发生的事实。API 能不能成功是另一个问题——那个问题用 retry、fallback、error message 来处理。但用户的意图已经发生了，这个事实不应该因为下游失败而消失。

这有点像数据库里的 WAL（Write-Ahead Log）——先把操作意图写进日志，再执行真正的数据变更。即使执行阶段崩溃，意图还在，恢复就有了基础。

## 不同模式下的差异

Claude Code 并没有对所有场景用同一套坚持。`recordTranscript()` 在两种模式下行为不同：

- **交互式会话（REPL）**：同步写，确保进入 API 调用前数据已落盘
- **脚本模式（`--bare` / `-p`）**：fire-and-forget，不阻塞关键路径

这个区分本身也是一个工程取舍的示范：不是"先写 transcript 是绝对正确的"，而是"在恢复价值高的场景下，这个成本是值得的；在一次性脚本里，保持路径简洁更重要"。

## 边界条件分析

**Q: 如果 `recordTranscript` 本身失败了怎么办？**

写盘失败的错误通常会被 catch 但不会中止主流程——对于一次完整的会话来说，写盘失败是异常情况，不应该让用户的请求直接失败。但这也意味着存在一个极端情况：写盘失败 + 进程崩溃 = 这条消息丢失。这是一个有意识的权衡，不是 bug。

**Q: 如果用户消息很大（附带大量图片），先写盘不会很慢吗？**

`processUserInput()` 会先处理附件，真正写盘的是经过处理后的消息结构，不是原始字节。另外，transcript 写盘通常是追加写，对大多数操作系统来说是非常快的操作。

## 面试指导

这类"顺序就是设计"的题在系统设计面试里很常见。回答时，不要只说"先写 transcript 是为了容错"——面试官希望听到你能回答"容什么错、怎么容、代价是什么"。

Claude Code 的答案：
- 容的是"API 调用前进程崩溃"这一类错误
- 容的方法是把用户意图提前持久化，与下游结果解耦
- 代价是关键路径上增加了 IO，在脚本模式下通过 fire-and-forget 缓解

这个模式在很多可靠性系统里都有对应：WAL、事件溯源（Event Sourcing）、消息队列的 at-least-once delivery。如果你能在面试中把这道具体的代码题和这些模式连起来，回答会更有深度。
