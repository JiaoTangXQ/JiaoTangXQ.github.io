---
title: "自动压缩解决生存，手动 compact 解决主导权"
slug: "10-04-01-compact"
date: 2026-04-09
topics: [上下文管理]
summary: "这一页重点看“自动压缩解决生存，手动 compact 解决主导权”。对应源码主要是 `src/commands/compact/index.ts`、`src/commands/compact/comp..."
importance: 1
---

# 自动压缩解决生存，手动 compact 解决主导权

## 实现链

这一页重点看“自动压缩解决生存，手动 compact 解决主导权”。对应源码主要是 `src/commands/compact/index.ts`、`src/commands/compact/compact.ts`。
这一章真正落在 `/compact` 命令实现和 `commands/compact/compact.ts` 的手动整理链上。Claude Code 保留手动 compact，不只是为了给用户一个按钮，而是为了把“怎么整理当前历史”继续留在用户主导之下。

## 普通做法

更常见的做法，是既然已经有自动压缩，就干脆把整理权完全交给系统，用户只负责继续对话。

## 为什么不用

Claude Code 没这么做，因为自动压缩解决的是生存，不是主导权。用户有时知道什么应该保、什么可以删、什么需要补自定义整理指令，这些判断不适合完全外包给默认策略。

## 代价

这样做的好处是用户仍能控制整理方向。代价是系统必须同时维护手动和自动两条压缩路径，行为也不可能完全统一。
