---
title: "DebugLogger 把不同级别日志统一送回宿主口音，说明新世界也不另起一套观测语言"
slug: "12-07-06-debuglogger"
date: 2026-04-09
topics: [外延执行]
summary: "`DebugLogger` 看起来只是一个小类，但它做的事很关键：把 `silly`、`debug`、`info`、`warn`、`error` 这些不同级别的浏览器侧日志，最后都翻回 Claude ..."
importance: 1
---

# DebugLogger 把不同级别日志统一送回宿主口音，说明新世界也不另起一套观测语言

`DebugLogger` 看起来只是一个小类，但它做的事很关键：把 `silly`、`debug`、`info`、`warn`、`error` 这些不同级别的浏览器侧日志，最后都翻回 Claude Code 自己的 `logForDebugging()` 口音里。也就是说，新接进来的浏览器世界没有另起一套观测语言。

这就是统一宿主感的一部分。真正优雅的接入，不只是工具名和权限模式统一，连“出了事以后大家怎么说话”都应该统一。

## 实现链
`mcpServer.ts` 里的 `DebugLogger` 实现了外部包要求的 `Logger` 接口，但最终全都转发到 `logForDebugging()`。浏览器桥没有自己另起一套日志口音，而是接回宿主的调试体系。

## 普通做法
普通做法是扩展集成自己 `console.log`，CLI 侧再看另一份日志。

## 为什么不用
Claude Code 不想把观测再拆成两份，因为跨边界问题最怕“浏览器一份日志，CLI 一份日志，谁也对不上”。

## 代价
代价是要写额外 adapter，把第三方 logger 口型翻译回内部日志体系。

