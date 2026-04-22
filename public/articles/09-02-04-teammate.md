---
title: "同进程 Teammate 完成任务后为什么不自动把结果传给 Leader？"
slug: "09-02-04-teammate"
date: 2026-04-09
topics: [多Agent协作]
importance: 1
---

# 同进程 Teammate 完成任务后为什么不自动把结果传给 Leader？

`inProcessRunner.ts` 里有一段注释，翻译过来大概是：

> 不会自动把 teammate 的响应推给 leader。这需要靠 SendMessage 工具完成。teammate 完成后只发送一条 idle notification，告知 leader"我空了"或"我失败了"，不传完整内容。

这个设计决策乍一看很奇怪：同进程里，直接把 teammate 的输出 append 到 leader 的消息列表不是举手之劳吗？为什么要故意不做？

## 技术上有多容易

先量化一下"走捷径"有多简单。

In-process teammate 和 leader 共享同一个 `AppState`，leader 的 `messages` 数组可以直接被访问和修改。写一个函数：

```typescript
function appendTeammateResultToLeader(
  result: string,
  setAppState: SetAppStateFn
) {
  setAppState(prev => ({
    ...prev,
    messages: [...prev.messages, createUserMessage(result)]
  }))
}
```

5 行代码。当 teammate 完成时调用这个函数，结果立刻出现在 leader 的上下文里。

但 `inProcessRunner.ts` 没有这么做。它只做了一件事：写入 idle notification 到 mailbox，通知 leader"我完成了"。leader 如果想要内容，需要 teammate 在完成前主动 `SendMessage`。

## 为什么不走这条路

**跨后端一致性**。这是最根本的原因。

Tmux pane teammate 和 leader 在不同进程，根本没法直接修改 leader 的内存。tmux teammate 完成任务后，只能通过 mailbox 通知 leader，leader 再决定要不要去查询结果。

如果 in-process teammate 可以直接注入结果，那就产生了两套团队语义：

- In-process teammate：结果自动可见
- Tmux teammate：结果需要显式发送

这会造成 leader 代码需要区分两种 teammate 类型，测试需要覆盖两个路径，prompt engineering 需要告诉 AI "in-process 的结果会自动出现，tmux 的不会"。

一致性的代价变成了整个系统的复杂度。

**显式可见性原则**。

如果 in-process teammate 的结果自动出现在 leader 的上下文里，leader 的上下文会随着时间累积大量来自不同 teammate 的中间结果。这不只是"结果"，还包括 teammate 工作过程中的思考、失败尝试、中间状态。

这些信息大部分对 leader 是噪音，少部分是真正需要的结论。但如果一切自动注入，leader 就没有机会过滤——它必须处理所有自动进来的内容。

显式发送 `SendMessage` 迫使 teammate 在完成时做一个决策：**我的哪些输出值得告诉 leader？** 这个决策过程本身是有价值的。

**上下文 pin 问题**。

`inProcessRunner.ts` 里专门处理了 `toolUseContext.messages`：

```typescript
// Strip messages: the teammate never reads toolUseContext.messages
// (runAgent overrides it via createSubagentContext). Passing the
// parent's conversation would pin it for the teammate's lifetime.
toolUseContext: { ...this.context, messages: [] },
```

如果把父 agent（leader）的对话历史传给 teammate，这段历史会在 teammate 的整个生命周期里占用 context window，不管 teammate 用不用这些信息。这叫 context pin 问题——把不必要的历史"钉"在了上下文里。

反过来，如果 teammate 的全部输出自动流回 leader，leader 的 context 就会被 5 个 teammate 的完整工作历史填满。这会让 leader 很快达到 context 限制，而大部分塞进去的内容并不是 leader 做决策时真正需要的。

## Idle Notification 做了什么

`inProcessRunner.ts` 里，teammate 完成时发送的 idle notification 包含：

- 完成状态（success / error / abort）
- 最后一条摘要消息
- 是否进入 idle 等待

注意：不包含完整的工作历史，不包含中间结果，只有结果状态。

Leader 收到 idle notification 后，知道这个 teammate 空了，可以：
1. 给它派新任务
2. 忽略它（如果已经通过 `SendMessage` 获得了需要的信息）
3. 发 shutdown 请求让它退出

这个设计给了 leader 最大的控制权——leader 决定是否、何时、如何获取 teammate 的工作成果，而不是结果自动涌进来。

## 面试怎么答

如果面试题是"多 agent 系统里 worker 的结果如何传递给 leader"：

**幼稚答案**：直接共享内存，worker 写进去 leader 读出来。不考虑跨进程场景，不考虑上下文污染。

**工程答案**：显式消息传递，worker 完成后发 SendMessage，leader 订阅并处理。一致、可追踪、可过滤。

**架构思考**：区分"完成通知"和"结果内容"——通知是必须发的（让 leader 知道 worker 空了），内容是选择性发的（worker 判断哪些值得共享）。不要把这两件事合并成"把所有输出推给 leader"。

**加分点**：Context pin 问题是多 agent 系统里常被忽视的实际工程问题。当 agent 运行时间越来越长，context window 管理比单次调用时更关键。显式控制"哪些信息进入哪个 agent 的上下文"是保持系统长期可用性的关键设计。
