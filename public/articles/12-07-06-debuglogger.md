---
title: "DebugLogger：把外部库的日志口音翻译回宿主语言"
slug: "12-07-06-debuglogger"
date: 2026-04-09
topics: [外延执行]
importance: 1
---

# DebugLogger：把外部库的日志口音翻译回宿主语言

集成第三方库时，日志是一个常见的不一致来源。第三方库有自己的日志接口，自己的级别定义，自己的格式约定。如果让它们各自输出到自己的地方，诊断系统的工程师就需要同时看多个地方：「Claude Code 的日志在这里，MCP 库的日志在那里，bridge 的日志在另一个地方……」

`DebugLogger` 解决的就是这个问题：

```typescript
class DebugLogger implements Logger {
  silly(msg: string) { logForDebugging('silly', msg); }
  debug(msg: string) { logForDebugging('debug', msg); }
  info(msg: string)  { logForDebugging('info',  msg); }
  warn(msg: string)  { logForDebugging('warn',  msg); }
  error(msg: string) { logForDebugging('error', msg); }
}
```

外部包要求的 `Logger` 接口被实现，但实现里所有方法都转发到 Claude Code 自己的 `logForDebugging()`。外部包「说」的日志，最终以宿主的口音出现在宿主的日志系统里。

## Adapter 模式的实际价值

这是一个经典的 Adapter 模式应用——把不兼容的接口翻译成目标接口。但它的价值不只是解决接口不匹配，更重要的是维持观测系统的统一性。

线上出现跨边界问题时（浏览器扩展连上了，但工具调用失败了），工程师打开一个日志系统，看到一条时间线，里面同时包含 Claude Code 内部的日志和 MCP 库的日志，用同一种格式排列。问题在哪里，一眼可以看出。

如果没有 `DebugLogger`，MCP 库的日志会走它自己的路——可能是 `console.log`，可能是 stderr，可能根本找不到。跨边界问题最难诊断，而这类问题最需要完整的日志时间线。

## 「一种日志系统」是一种工程承诺

选择为所有接入的外部能力实现统一的日志 adapter，是在做一个明确的工程承诺：**不管新能力来自哪里，它的运行状态对宿主是可见的，用宿主的工具可以观测**。这个承诺越早落实，系统的可维护性就越强。
