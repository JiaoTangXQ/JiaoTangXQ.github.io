---
title: "stdin 一断先 flush 分析再退出，说明浏览器 MCP server 也要体面收场"
slug: "12-07-05-stdinflushmcp-server"
date: 2026-04-09
topics: [外延执行]
summary: "浏览器 MCP server 的收场顺序也很讲究。它不是一发现父进程断开就立刻粗暴退出，而是先把第一方事件日志和 Datadog 都尽量冲干净，再真正 `exit`。这说明在 Claude Code ..."
importance: 1
---

# stdin 一断先 flush 分析再退出，说明浏览器 MCP server 也要体面收场

浏览器 MCP server 的收场顺序也很讲究。它不是一发现父进程断开就立刻粗暴退出，而是先把第一方事件日志和 Datadog 都尽量冲干净，再真正 `exit`。这说明在 Claude Code 心里，“断线”不是可以随便烂尾的时刻，而是仍然要好好收口的一部分。

这种设计常常只藏在几行清理代码里，却特别值钱。因为只要系统真要长期跑，收场纪律就和开场纪律一样重要。

## 实现链
`runClaudeInChromeMcpServer()` 在 `stdin` end/error 时不会直接 `process.exit(0)`，而是先跑 `shutdown1PEventLogging()` 和 `shutdownDatadog()` 再退出。浏览器 MCP server 的收场被当成正式工程问题处理。

## 普通做法
普通子进程服务器常常父进程一断就立刻退出。

## 为什么不用
Claude Code 不这么草率，因为浏览器掉线、断开和收尾事件本身就是线上诊断线索，直接死掉会把最后一批观测丢掉。

## 代价
代价是退出路径更长，也多了一层“收尾本身可能出错”的复杂度。

