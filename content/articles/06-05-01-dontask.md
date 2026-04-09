---
title: "dontAsk真正做的是把审批改成拒绝"
slug: "06-05-01-dontask"
date: 2026-04-09
topics: [治理与权限]
summary: "这一页重点看“dontAsk真正做的是把审批改成拒绝”。对应源码主要是 `src/utils/permissions/permissions.ts`。 这一章真正落在 `permissions.ts`..."
importance: 1
---

# dontAsk真正做的是把审批改成拒绝

## 实现链

这一页重点看“dontAsk真正做的是把审批改成拒绝”。对应源码主要是 `src/utils/permissions/permissions.ts`。
这一章真正落在 `permissions.ts` 和 `permissionSetup.ts` 对 `dontAsk`、`auto` 的处理上。Claude Code 没把这些模式做成“更放开”的快捷键，而是让 `dontAsk` 更偏向 fail-closed，让 `auto` 额外引入分类器、门禁和模式转换逻辑。

## 普通做法

更容易想到的做法，是把 `dontAsk` 理解成默认放行，把 `auto` 理解成尽量少打断用户。这样名字和直觉更一致，也更容易营销。

## 为什么不用

Claude Code 没这么命名就这么实现，是因为它优先考虑的是风险闭环，而不是名称讨喜。`dontAsk` 如果直接放行，会变成静默越权；`auto` 如果没有额外治理，只是把审批换成更隐蔽的拍板。

## 代价

现在这套做法更安全，也更诚实。代价是模式名称容易让人误会，尤其是第一次用的人会以为自己开了“更自由”的模式，结果发现系统其实更克制。
