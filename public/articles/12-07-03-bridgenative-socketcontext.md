---
title: "bridge 和 native socket 共用同一 context，说明浏览器世界先进统一制度再分线路"
slug: "12-07-03-bridgenative-socketcontext"
date: 2026-04-09
topics: [外延执行]
summary: "`createChromeContext()` 最见功力的地方，不是它会不会连桥，而是它先把身份、日志、socket 路径、配对记忆、权限模式、遥测边界这些共同制度钉成一个 `context`，然后才..."
importance: 1
---

# bridge 和 native socket 共用同一 context，说明浏览器世界先进统一制度再分线路

`createChromeContext()` 最见功力的地方，不是它会不会连桥，而是它先把身份、日志、socket 路径、配对记忆、权限模式、遥测边界这些共同制度钉成一个 `context`，然后才决定这次到底走 bridge 还是 native socket。也就是说，线路可以分，制度不能分。

这很重要，因为很多系统一碰外部世界就会长出两套人格：走这一条线时一套规则，走另一条线时另一套规则。Claude Code 没这么做。它先让浏览器世界承认同一部“宪法”，再允许不同线路各自把活干完。这才叫把新世界接回旧秩序，而不是再造第二台机器。

## 实现链
`createChromeContext()` 同时塞进 `socketPath/getSocketPaths`、`bridgeConfig`、`logger`、`trackEvent`、`onExtensionPaired` 和权限模式。也就是说，bridge 和 native socket 不是两套系统，只是同一 context 里的两条线路。

## 普通做法
普通设计会把本地 socket 和远端 bridge 完全拆成两套 client。

## 为什么不用
Claude Code 不这么拆，因为它想让配对、权限、日志和掉线文案在两条线路上保持同一种制度。

## 代价
代价是这个 context 会越来越胖，读起来不像一个轻巧的数据对象。

