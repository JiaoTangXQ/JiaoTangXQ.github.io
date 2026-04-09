---
title: "autocompact是在保会话，不是在做漂亮整理"
slug: "10-03-02-autocompact"
date: 2026-04-09
topics: [上下文管理]
summary: "这一页重点看“autocompact是在保会话，不是在做漂亮整理”。对应源码主要是 `src/services/compact/autoCompact.ts`、`src/query.ts`。 这一章真..."
importance: 1
---

# autocompact是在保会话，不是在做漂亮整理

## 实现链

这一页重点看“autocompact是在保会话，不是在做漂亮整理”。对应源码主要是 `src/services/compact/autoCompact.ts`、`src/query.ts`。
这一章真正落在 `autoCompact.ts` 的阈值、预算、跳过条件、失败熔断，以及 `query.ts` 对 autocompact 的编排上。Claude Code 把 autocompact 做成系统级保命机制：先算预算，再决定要不要压；真的不适合压时，还会跳过或熔断。

## 普通做法

更简单的做法，要么固定到阈值就压，要么上下文超限就直接报错让用户自己处理。这样逻辑更短，也更好解释。

## 为什么不用

Claude Code 没选这两条极端路线，因为它要保的是会话能继续工作，而不是把整理动作本身做漂亮。固定阈值无脑压会和其他机制打架，直接报错又等于把连续性问题全推给用户。

## 代价

现在这套设计更像减灾系统，能在复杂条件下少自相残杀。代价是规则很多：阈值、buffer、跳过条件、失败上限都会增加理解难度。
