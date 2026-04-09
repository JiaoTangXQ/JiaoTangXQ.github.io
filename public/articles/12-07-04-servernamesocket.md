---
title: "serverName 和 socket 路径一起保住同一种运行时口音"
slug: "12-07-04-servernamesocket"
date: 2026-04-09
topics: [外延执行]
summary: "很多人会把 `serverName`、`socketPath`、`getSocketPaths()` 这种东西当成不起眼的管线细节，但它们其实在替整套系统维持同一种口音。名字告诉别人“我是谁”，路径告..."
importance: 1
---

# serverName 和 socket 路径一起保住同一种运行时口音

很多人会把 `serverName`、`socketPath`、`getSocketPaths()` 这种东西当成不起眼的管线细节，但它们其实在替整套系统维持同一种口音。名字告诉别人“我是谁”，路径告诉别人“我在哪”，而多路径发现又告诉别人“如果现场不干净，该去哪里重新找到我”。

浏览器世界之所以没有变成一团临时接线，很大一部分功劳就在这些小连接件上。它们让浏览器能力即使跨过 native host、socket 和 bridge，也还能被同一套运行时语言认出来、接回来、修回来。这正是成熟工程里最容易被低估的巧思。

## 实现链
`createChromeContext()` 把 `serverName` 固定成 `Claude in Chrome`；`common.ts` 又统一了 `CLAUDE_IN_CHROME_MCP_SERVER_NAME`、socket 目录和 path 构造。显示名、MCP 名和连接地址一起维持同一身份。

## 普通做法
普通做法是显示名一个、连接名一个、底层路径再自己拼一套。

## 为什么不用
Claude Code 不想让这些身份分裂，因为 reconnect、UI 和日志都要靠它们相互对上。

## 代价
代价是命名体系显得更保守，局部想换名会牵动很多地方。

