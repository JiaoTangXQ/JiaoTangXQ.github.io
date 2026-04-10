---
title: "Bash 工具失败为什么会触发 siblingAbortController？"
slug: "220-bash"
date: 2026-04-09
topics: [Claude Code 源码, BashTool, 并发, 错误传播]
summary: "StreamingToolExecutor 维护了一个 siblingAbortController，专门在 Bash 工具出错时向兄弟子进程发送取消信号。这个设计防止一个 Bash 失败后其他已启动的 Bash 继续跑到底，节省资源并防止副作用扩散。"
importance: 0.9
---

# Bash 工具失败为什么会触发 siblingAbortController？

## 隐含的并发假设

当模型在一轮里同时发起多个 Bash 工具调用时，Claude Code 会并发执行它们（如果都被判断为 concurrency-safe 的话）。

现在问题来了：如果其中一个 Bash 失败了，其他还在跑的 Bash 该怎么处理？

选项 A：等它们全部跑完，再统一上报错误。
选项 B：立刻给所有兄弟进程发取消信号。

Claude Code 选了 B，原因很有意思。

## siblingAbortController 的设计

`StreamingToolExecutor` 的构造函数里：

```typescript
// src/services/tools/StreamingToolExecutor.ts
export class StreamingToolExecutor {
  // Child of toolUseContext.abortController. Fires when a Bash tool errors
  // so sibling subprocesses die immediately instead of running to completion.
  // Aborting this does NOT abort the parent — query.ts won't end the turn.
  private siblingAbortController: AbortController

  constructor(...) {
    this.siblingAbortController = createChildAbortController(
      toolUseContext.abortController,
    )
  }
}
```

注释写得很清楚：它是 `toolUseContext.abortController` 的**子控制器**。当 Bash 工具出错时触发，会给所有兄弟子进程发取消信号，但**不会**触发父控制器——也就是说，主循环这一轮不会被整个终止，只是并发的兄弟任务被取消了。

## 为什么不等兄弟跑完

两个原因：

**1. 副作用不可逆**

Bash 工具可能正在写文件、修改数据库、调用 API。如果第一个 Bash 已经失败（可能是因为某个前置条件不满足），继续让其他 Bash 在这个前提下执行，结果可能是一半写了一半没写的状态——比两种都没做更难处理。

**2. 隐含的依赖链**

并发的 Bash 调用表面上是独立的，但实际上可能存在隐含依赖：第一个创建目录，第二个写文件到该目录。第一个失败了，第二个继续跑会写到不存在的目录，产生更多错误。

这就是文章标题说的「错误不能沿隐含依赖扩散」——在错误真正扩散之前，先把可能受影响的兄弟进程拦住。

## 子控制器而非父控制器

这个区分很精妙：

- 如果触发父控制器：整轮结束，所有工具全部取消，模型看不到任何结果
- 如果只触发子控制器：只取消兄弟 Bash，其他类型的工具（如读文件、搜索）不受影响

这让 `StreamingToolExecutor` 可以做局部止损：Bash 出错后，同批次的其他 Bash 取消，但这一轮本身还能继续（模型会看到部分成功、部分被取消的结果，并据此决策）。

## 与错误传播设计的关系

这个设计体现了一个更广泛的原则：**错误有作用域，不应该默认全局传播**。

Bash 失败是一个局部事件，但它的影响可以扩散到同批次的兄弟进程。`siblingAbortController` 是一个显式的「扩散边界」——它允许错误向兄弟传播，但不允许向父级（整个主循环）传播。

没有这个边界，错误处理只有两个极端：要么完全忽略（让兄弟继续跑），要么全局终止（整轮失败）。两种都不是最优的。

## 面试参考

被问「你们怎么处理并发任务中单个任务失败」时，这个模式值得提：

1. 定义错误的传播范围（局部 vs 全局）
2. 用子控制器实现局部取消，而不是要么全传要么全不传
3. 考虑隐含依赖——逻辑上独立的任务可能有状态依赖

Claude Code 的 `siblingAbortController` 是这个模式的一个简洁实现。
