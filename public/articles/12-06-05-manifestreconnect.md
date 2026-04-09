---
title: "一旦改写 manifest 就主动补 reconnect 这最后一公里，说明产品动作也属于接入链"
slug: "12-06-05-manifestreconnect"
date: 2026-04-09
topics: [外延执行]
summary: "这条线的成熟，不只在“把文件写对”，还在“写完以后帮用户把最后一步补上”。只要 manifest 真被改写过，系统就会判断扩展是否已经在场；如果在，就主动把 reconnect 页面打开。它在承认一个..."
importance: 1
---

# 一旦改写 manifest 就主动补 reconnect 这最后一公里，说明产品动作也属于接入链

这条线的成熟，不只在“把文件写对”，还在“写完以后帮用户把最后一步补上”。只要 manifest 真被改写过，系统就会判断扩展是否已经在场；如果在，就主动把 reconnect 页面打开。它在承认一个经常被忽略的现实：技术安装完成，不等于用户现场真的接上了。

真正的接入链不该在最后一米撒手。Claude Code 把“提醒你去重连”也算成产品责任的一部分，所以这条链才更像可用产品，而不是开发者自测脚本。

## 实现链
`installChromeNativeHostManifest()` 记录 `anyManifestUpdated`，只要这次真改写过 manifest，后面就会检查扩展是否已装，并在合适时调用 `openInChrome(CHROME_EXTENSION_RECONNECT_URL)`。产品动作本身被算进接入链，而不是留给用户猜。

## 普通做法
更常见的做法是写完文件就算完成，让用户自己重启浏览器或自己找 reconnect。

## 为什么不用
Claude Code 不把这一步甩给用户，因为 native host 这种问题最容易卡在“其实装好了，但还没重新连上”。

## 代价
代价是工具会显得更主动，某些用户可能会觉得它替自己做决定。

