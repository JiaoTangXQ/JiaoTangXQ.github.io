---
title: "processUserInput 在整条会话链里站在哪里"
slug: "03-01-02-processuserinput"
date: 2026-04-09
topics: [输入与路由]
summary: "如果把 Claude Code 想成一条流水线，`processUserInput()` 站的位置非常关键。它不在最底层，因为它不是单纯接收键盘字符；它也还没进入主循环，因为这时系统还没准备好把这一轮..."
importance: 1
---

# processUserInput 在整条会话链里站在哪里

如果把 Claude Code 想成一条流水线，`processUserInput()` 站的位置非常关键。它不在最底层，因为它不是单纯接收键盘字符；它也还没进入主循环，因为这时系统还没准备好把这一轮真正交给模型。它更像输入世界和会话世界之间的那道分拣台。

这道分拣台前面，只有原始输入、粘贴内容、图片、附件候选、bridge 来源这些“还没被系统承认”的材料。过了这道分拣台，后面拿到的就已经是更正式的会话消息了: 是普通提示，还是 Bash，还是 slash 命令，要不要补系统级 caveat，要不要带上图片元信息，要不要先经过用户输入 hooks，都会在这里先做出判断。

所以 `processUserInput()` 的真正位置，不是某个小工具函数，而是整个会话前台的总装配口。Claude Code 把它放在 QueryEngine 之前，本质上是在说: 模型不该自己面对混乱输入，系统要先把这轮来客整理成一件它能够正确接手的事。这个位置放对了，后面的主循环才有资格显得稳定。

## 实现链
它站在 `PromptInput` 和 `QueryEngine.query()` 之间。`QueryEngine.submitMessage()` 先调用它，拿回 `messages`、`shouldQuery`、`allowedTools`、`model`、`nextInput` 这些结果，再决定要不要真正进入本轮 query。

## 普通做法
很多系统会把输入清洗逻辑直接塞进主循环，或者反过来丢给 UI 层各自处理。

## 为什么不用
因为这里需要同时知道消息历史、权限上下文、命令集合、bridge 来源和附件环境。它既不是纯 UI 逻辑，也不是纯模型逻辑，更适合做成独立的翻译边界。

## 代价
多了一层抽象，追调用链时要多跳一个函数；但分层以后，“入口怎么翻译”就不会和“本轮怎么推进”搅在一起。
