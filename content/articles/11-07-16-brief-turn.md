---
title: "dropTextInBriefTurns 只删模型的多余话，不删用户的证据"
slug: "11-07-16-brief-turn"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# dropTextInBriefTurns 只删模型的多余话，不删用户的证据

`dropTextInBriefTurns()` 和 `filterForBriefTool()` 是 brief 模式的两个不同层次的过滤器。前者用于完整的 transcript 视图，后者用于主会话视图。

理解 `dropTextInBriefTurns()` 需要先理解它要解决的问题。

## Brief 工具的作用

当模型在某轮对话里调用了 Brief 工具，Brief 工具会产生一个简洁的摘要。这个摘要本来就是对这轮工作的压缩表达。

但模型在产生这个摘要之外，可能还写了一大段助手文本——解释它做了什么、为什么这样做、结果是什么。这段文本和 Brief 工具的输出是冗余的：它们在表达同样的内容，只是详细程度不同。

## 什么被删，什么被留

`dropTextInBriefTurns()` 的规则：

- **检查条件**：这一轮是否有 Brief 工具的 `tool_use` 调用
- **如果是**：删除这一轮里助手产生的文本块（text content blocks）
- **不动的**：用户的输入、工具结果、system 消息、所有其他轮次

它删除的是「Brief 工具已经更精炼地表达过的那段铺陈」，不是「这轮发生的所有事情」。

## 精确的边界

brief 的设计目标是减少阅读量，不是抹除信息。删掉的是已经有更好替代的助手铺陈；留下的是用户说了什么（用户的输入）、工具实际做了什么（工具结果）以及 Brief 工具的摘要。

用户仍然能看到：我提了什么要求、系统执行了哪些操作、Brief 工具给出了什么结论。这条因果链保持完整。

被删掉的是：模型用来「解释自己」的那段助手文字——因为 Brief 工具已经替它说完了，更精炼。
