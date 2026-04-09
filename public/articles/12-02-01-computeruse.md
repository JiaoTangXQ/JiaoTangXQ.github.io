---
title: "computerUse被包成一整套能力簇，而不是零散动作"
slug: "12-02-01-computeruse"
date: 2026-04-09
topics: [外延执行]
summary: "Claude Code 没把桌面操作粗暴做成“点击一下、输入一段、截图一下”这种零散本地工具，而是把它认真包成一整套 `computerUse` 能力簇，再接成 MCP 世界。 这背后的判断很成熟：桌..."
importance: 1
---

# computerUse被包成一整套能力簇，而不是零散动作

Claude Code 没把桌面操作粗暴做成“点击一下、输入一段、截图一下”这种零散本地工具，而是把它认真包成一整套 `computerUse` 能力簇，再接成 MCP 世界。

这背后的判断很成熟：桌面能力不是几招动作，而是一类完整工作方式。只有把它当成一整簇能力，后面的权限、提示词、渲染和会话状态才有可能一起说同一种语言。

## 实现链
`setupComputerUseMCP()` 先调用 `buildComputerUseTools(CLI_CU_CAPABILITIES, getChicagoCoordinateMode())` 生成整簇工具，再用 `buildMcpToolName(COMPUTER_USE_MCP_SERVER_NAME, t.name)` 统一命名。`client.ts` 和 `toolRendering.tsx` 看到的是一整套 `mcp__computer-use__*`，不是零散本地函数。

## 普通做法
普通做法是直接暴露几个内置命令，比如点击、输入、截图各自一把锤子。

## 为什么不用
Claude Code 不这么做，因为桌面动作要和后端提示、权限、渲染、会话状态一起配套；如果只是零散工具，系统其他层根本认不出“这是 computer use 能力簇”。

## 代价
代价是为了保住这层统一身份，要多套一层 MCP 包装和命名约束，阅读时会比“直接调函数”更绕。

