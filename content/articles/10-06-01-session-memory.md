---
title: "session memory 把当前工作状态外置成一份笔记"
slug: "10-06-01-session-memory"
date: 2026-04-09
topics: [上下文管理]
summary: "这一页重点看“session-memory-把当前工作状态外置成一份笔记”。对应源码主要是 `src/services/SessionMemory/sessionMemory.ts`。 这一章真正落在..."
importance: 1
---

# session memory 把当前工作状态外置成一份笔记

## 实现链

这一页重点看“session-memory-把当前工作状态外置成一份笔记”。对应源码主要是 `src/services/SessionMemory/sessionMemory.ts`。
这一章真正落在 `SessionMemory/sessionMemory.ts` 的初始化、阈值判断和外置笔记写入逻辑上。Claude Code 把 session memory 做成一份外置工作记忆：它不抢主回合，而是在适合的时候把当前工作状态外提到单独笔记里。

## 普通做法

更直觉的做法，是每轮都自动写一点记忆，或者把工作状态继续塞在主会话里不另做外置层。

## 为什么不用

Claude Code 没这么做，因为工作记忆如果每轮都急着写，就会反过来拖慢主循环；如果完全不外置，连续工作状态又会一直挤占主窗口。它选择在阈值和自然停顿点更新，是在两种代价之间找平衡。

## 代价

这样做的好处是主回合更少被打扰。代价是 session memory 永远不是“实时镜像”，它可能滞后一小段，需要接受这份外置记忆是节奏化更新而不是每轮同步。
