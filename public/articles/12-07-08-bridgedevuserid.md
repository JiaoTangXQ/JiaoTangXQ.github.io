---
title: "本地 bridge 才带 devUserId，说明开发便利被认真关在实验围栏里"
slug: "12-07-08-bridgedevuserid"
date: 2026-04-09
topics: [外延执行]
summary: "Claude Code 并不是把所有开发期便利都混进正式线路里。只有在本地 bridge 场景下，它才会额外带上 `devUserId` 这类开发辅助信息。也就是说，开发便利被刻意关在实验围栏里，没有..."
importance: 1
---

# 本地 bridge 才带 devUserId，说明开发便利被认真关在实验围栏里

Claude Code 并不是把所有开发期便利都混进正式线路里。只有在本地 bridge 场景下，它才会额外带上 `devUserId` 这类开发辅助信息。也就是说，开发便利被刻意关在实验围栏里，没有顺手污染正式世界。

这种克制很重要，因为很多系统不是死在功能不够，而是死在实验便利一路混进生产现实。Claude Code 在这里很清醒：方便开发可以，但得关在明确边界内。

## 实现链
`createChromeContext()` 只有在 `isLocalBridge()` 时才给 `bridgeConfig` 附上 `devUserId: 'dev_user_local'`。开发便利被明确关在本地桥路径里，没有泄漏到正常线上路径。

## 普通做法
偷懒做法是所有环境都顺手带一个固定开发标识。

## 为什么不用
Claude Code 不敢这么做，因为桥接系统牵涉真实账号和浏览器现场，开发捷径一旦溢出就会污染线上身份。

## 代价
代价是本地调试和线上行为存在差异，开发者需要知道自己是否在实验围栏里。

