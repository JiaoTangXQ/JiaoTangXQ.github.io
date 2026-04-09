---
title: "auto 模式一旦退回 in-process，就要让全局一起承认现实"
slug: "09-08-05-autoin-process"
date: 2026-04-09
topics: [多Agent协作]
summary: "`auto` 模式听起来像随时可变，但 Claude Code 一旦判定这次只能退回 in-process，就会让全局一起承认这个现实。 `registry.ts` 里有 `inProcessFall..."
importance: 1
---

# auto 模式一旦退回 in-process，就要让全局一起承认现实

`auto` 模式听起来像随时可变，但 Claude Code 一旦判定这次只能退回 in-process，就会让全局一起承认这个现实。

## 实现链

`registry.ts` 里有 `inProcessFallbackActive`。一旦某次 spawn 因为 pane backend 不可用而回退到 in-process，后续 `isInProcessEnabled()` 在 auto 模式下就直接返回 true，短路掉继续幻想 pane backend 会突然可用的路径。

## 普通做法

普通做法会每次都重试，期待下一次环境就变好了。

## 为什么不用

Claude Code 不愿意让系统持续活在愿望里。既然这次现实证明 pane backend 不可用，那团队制度、菜单和提示都应该一起切到 in-process 口径，而不是一边回退一边假装还能有原生 pane。

## 代价

代价是这种策略比较保守，可能放弃某些中途恢复的机会。但它换来了更诚实的一致性。
