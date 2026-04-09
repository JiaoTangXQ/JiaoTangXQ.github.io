---
title: "auto-memory 记的是项目长期知识，不是当前工作噪音"
slug: "10-08-01-auto-memory"
date: 2026-04-09
topics: [上下文管理]
summary: "这一页重点看“auto-memory-记的是项目长期知识，不是当前工作噪音”。对应源码主要是 `src/services/extractMemories/extractMemories.ts`。 这一..."
importance: 1
---

# auto-memory 记的是项目长期知识，不是当前工作噪音

## 实现链

这一页重点看“auto-memory-记的是项目长期知识，不是当前工作噪音”。对应源码主要是 `src/services/extractMemories/extractMemories.ts`。
这一章真正落在 `extractMemories.ts` 的长期记忆提炼逻辑上。Claude Code 不把 auto-memory 当成“把最近对话都存起来”，而是先筛掉当前工作噪音、检查是否刚写过 memory、再决定要不要把更长期的项目知识沉淀出去。

## 普通做法

更容易想到的做法，是每轮都尽量多存一点，反正以后也许用得上；或者凡是看起来像结论的内容都丢进长期记忆。

## 为什么不用

Claude Code 没这么做，因为长期记忆最怕的不是记少，而是被当前工作噪音淹没。它要保的是以后仍值得记得的知识，而不是今天这轮里刚发生的所有细枝末节。

## 代价

这样做更克制，长期记忆质量通常更高。代价是系统会主动放弃很多“也许以后有用”的内容，看起来没那么贪心，也没那么全。
