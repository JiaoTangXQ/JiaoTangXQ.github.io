---
title: "合成 tool_result 为什么是中断和 fallback 后的重要补救"
slug: "04-08-02-tool-resultfallback"
date: 2026-04-09
topics: [主循环]
summary: "现实里的运行时不会永远按理想路径收尾。模型可能流到一半就 fallback，用户可能在工具执行时打断，甚至底层 bug 也可能让一条 `tool_use` 刚露头就来不及正常结束。Claude Cod..."
importance: 1
---

# 合成 tool_result 为什么是中断和 fallback 后的重要补救

现实里的运行时不会永远按理想路径收尾。模型可能流到一半就 fallback，用户可能在工具执行时打断，甚至底层 bug 也可能让一条 `tool_use` 刚露头就来不及正常结束。Claude Code 在这些时候做的一件很关键的事，就是主动补写合成 `tool_result`。

这不是装样子，更不是伪造结果。它补写的通常正是失败、取消、fallback 丢弃这类事实。意思是：这次动作没有自然做完，但系统必须明确告诉后续世界，它已经以什么方式结束了。否则会出现最糟的情况: 会话里挂着一堆已经发出去、却永远没结案的动作，后面恢复、重试、继续都会越来越乱。

Claude Code 这里特别成熟。它宁可主动补一条明确的失败结果，也不愿意留下结构性烂尾。因为它知道，运行时真正怕的不是失败，而是失败以后没有记账。

所以合成 `tool_result` 的价值，不在于补文字，而在于补秩序。

代码里这件事落在两处：普通异常和 fallback 路径用 `yieldMissingToolResultBlocks()` 补，流式执行器自己也会为被放弃或被兄弟错误连带取消的工具生成 synthetic `tool_result`，内容明确写成 `Streaming fallback - tool execution discarded` 或 `Cancelled: parallel tool call ... errored`。更直觉的做法是简单丢掉这些半成品，因为“反正没成功，也没必要记”。

Claude Code 不敢这么丢，是因为 API、resume 和下一轮推理都需要看见“这次动作后来怎样了”。如果 transcript 里只有 `tool_use` 没有结果，后面的任何推理都会站在断裂历史上。代价是 transcript 中会出现一些并非真实外部工具输出、而是系统补写的说明性结果，但这比历史断掉更可接受。

## 实现链
异常、fallback 和流式中断都会补 synthetic `tool_result`，避免历史悬空。

## 普通做法
直接丢掉未完成的 tool_use。

## 为什么不用
因为只有 tool_use 没结果会破坏 API 轨迹和后续推理。

## 代价
会出现并非真实外部输出的系统补写结果。
