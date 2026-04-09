---
title: "manifest 要铺到多种浏览器目录，说明接入链先承认 Chromium 生态是碎的"
slug: "12-06-03-manifestchromium"
date: 2026-04-09
topics: [外延执行]
summary: "这条接入链并没有假装世界上只有一个“浏览器”。`NativeMessagingHosts` 的 manifest 要按平台、按浏览器、按目录分别去铺，Windows 还要补注册表。这种笨重不是代码写得..."
importance: 1
---

# manifest 要铺到多种浏览器目录，说明接入链先承认 Chromium 生态是碎的

这条接入链并没有假装世界上只有一个“浏览器”。`NativeMessagingHosts` 的 manifest 要按平台、按浏览器、按目录分别去铺，Windows 还要补注册表。这种笨重不是代码写得不优雅，而是它先承认了一个现实：Chromium 生态本来就是碎的。

真正的产品级接入，不是靠一句“支持浏览器”带过，而是要把这些分裂一项项吃下来。Claude Code 在这里选择正面承受现实，而不是用一个漂亮抽象把现实抹平。

## 实现链
`getAllNativeMessagingHostsDirs()` 和 `getAllBrowserDataPaths()` 会按 Chrome、Brave、Arc、Edge、Vivaldi、Opera 等多种 Chromium 浏览器生成路径；安装 manifest 时会逐个目录尝试写入。代码先承认碎生态存在，再做统一接入。

## 普通做法
简单做法是只支持 Google Chrome 一个目录。

## 为什么不用
Claude Code 不只写一个目录，因为用户真实浏览器世界本来就不是单一产品，特别是桌面开发者常常用 Brave、Arc 或 Edge。

## 代价
代价是安装步骤会更啰嗦，日志里也会出现大量“某路径写失败但继续”的分支。

