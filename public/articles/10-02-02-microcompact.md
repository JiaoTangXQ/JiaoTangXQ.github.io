---
title: "microcompact站在前面，是为了少惊动主会话"
slug: "10-02-02-microcompact"
date: 2026-04-09
topics: [上下文管理]
summary: "这一页重点看“microcompact站在前面，是为了少惊动主会话”。对应源码主要是 `src/query.ts`。 这一章真正落在 `query.ts` 里“先 microcompact，再决定 a..."
importance: 1
---

# microcompact站在前面，是为了少惊动主会话

## 实现链

这一页重点看“microcompact站在前面，是为了少惊动主会话”。对应源码主要是 `src/query.ts`。
这一章真正落在 `query.ts` 里“先 microcompact，再决定 autocompact”的排序，以及 `microCompact.ts` 的局部压缩策略上。Claude Code 先削局部、先减少碎接缝和局部负担，尽量不惊动整段主会话。

## 普通做法

更普通的做法，是一旦觉得上下文重了，就直接对整段历史做统一摘要，省掉前面的轻量预处理。

## 为什么不用

Claude Code 没先走整段重写，是因为整段改写太吵，也太容易把还在眼前工作的线索一起重排。它更偏向先做局部减肥，只有局部方案不够了，才动用更重的系统级压缩。

## 代价

这让主会话更稳定，也更少被粗暴改写。代价是连续性链路多了一层前置机制，读者必须理解“局部压缩”和“整段压缩”不是一回事。
