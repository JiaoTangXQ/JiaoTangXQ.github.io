---
title: "表面像 stdio server，内部却不必每次真起子进程"
slug: "12-04-01-stdio-server"
date: 2026-04-09
topics: [外延执行]
summary: "`computerUse` 这条线很能说明 Claude Code 的做法不是“为了统一而统一”。`setupComputerUseMCP()` 返回的配置表面上是标准 `stdio` MCP ser..."
importance: 1
---

# 表面像 stdio server，内部却不必每次真起子进程

`computerUse` 这条线很能说明 Claude Code 的做法不是“为了统一而统一”。`setupComputerUseMCP()` 返回的配置表面上是标准 `stdio` MCP server: 有 `command`、有 `args`、有 `scope`。但注释已经讲穿了：这些 `command/args` 实际不会真的被每次 spawn，`client.ts` 会按 server name 走 in-process 分支。换句话说，对外它保持一副“我就是普通 MCP server”的样子，对内却故意不付真正起子进程的成本。

更直觉的实现有两种。第一种是最老实的做法：既然叫 MCP server，那每次都真的起一个子进程。第二种是最省事的做法：既然都在本进程里，那干脆别装成 MCP，直接当内置工具。Claude Code 两条都没选。它保留了 MCP 外观，因为命名、system prompt、工具发现和后端提示都围着这层协议语言在工作；同时它又把执行留在进程内，因为这里追求的是低延迟和少一层不必要的进程管理。

这是一种典型的成熟工程取舍：外部接口稳定，内部实现克制。代价是阅读时会让人先困惑一下，“为什么配置像 stdio，实际却不 spawn”。但一旦看懂，你会发现这不是绕，而是故意把兼容性和效率同时保住。

## 实现链
`setupComputerUseMCP()` 返回的是标准 `type: 'stdio'` MCP 配置，`setupClaudeInChrome()` 也一样。但注释已经说明 `computerUse` 这一支不会真的按 `command/args` 每次 spawn 子进程，客户端会按 server name 走 in-process 分支；Chrome 侧则用同一个 `createChromeContext()` 同时服务子进程路径和进程内路径。

## 普通做法
一种纯粹做法是：既然叫 stdio MCP，就每次都老老实实起子进程。另一种极端是：既然都在本进程，就完全不要 MCP 外观。

## 为什么不用
Claude Code 两条都没选，因为它同时要保住外部协议的一致性和内部执行的低延迟。

## 代价
代价是这层实现对新读者不够直观，看配置像外部 server，看执行又像内置工具。

