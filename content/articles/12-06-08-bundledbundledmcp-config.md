---
title: "bundled 和非 bundled 走不同路径却回到同一 MCP config，说明产品形态差异不该改运行时口音"
slug: "12-06-08-bundledbundledmcp-config"
date: 2026-04-09
topics: [外延执行]
summary: "无论是 bundled 形态还是非 bundled 形态，Claude Code 都会因为打包方式不同而改动脚本路径和启动参数，但最后吐回来的还是同一种 `MCP config`、同一组 `allow..."
importance: 1
---

# bundled 和非 bundled 走不同路径却回到同一 MCP config，说明产品形态差异不该改运行时口音

无论是 bundled 形态还是非 bundled 形态，Claude Code 都会因为打包方式不同而改动脚本路径和启动参数，但最后吐回来的还是同一种 `MCP config`、同一组 `allowedTools`、同一句系统提示。这种设计很有分寸：产品形态可以不同，运行时口音不要乱。

这类统一特别重要，因为一旦外层形态差异直接污染运行时语言，后面的工具发现、权限判断和问题排查都会开始分叉。Claude Code 在这里刻意把分叉拦在更外面。

## 实现链
`setupClaudeInChrome()` 会根据 `isInBundledMode()` 决定是直接用当前二进制，还是指向 `cli.js`，但最终都返回同样形状的 `type: 'stdio'` 动态 MCP 配置、同样的工具名和同样的 system prompt。产品形态变了，运行时口音不变。

## 普通做法
普通做法是 bundled 和源码运行各自维护一套接入逻辑，甚至对外工具形状都不同。

## 为什么不用
Claude Code 不愿意让产品包装差异泄漏到能力协议层，否则后面每个消费者都得知道“现在是哪种打包方式”。

## 代价
代价是 setup 里要额外维护一套分支，把不同产物收口回同一接口。

