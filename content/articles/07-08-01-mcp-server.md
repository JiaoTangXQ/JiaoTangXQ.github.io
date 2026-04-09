---
title: "一个 MCP server 进来时，带来的不只是工具"
slug: "07-08-01-mcp-server"
date: 2026-04-09
topics: [扩展系统]
summary: "- `client.ts` 接入一个 MCP server 时，不只会建 `MCPTool`，还会把资源列表、资源读取工具、prompts 甚至 MCP skills 一起纳入本地运行时。 - 对 C..."
importance: 1
---

# 一个 MCP server 进来时，带来的不只是工具

## 实现链
- `client.ts` 接入一个 MCP server 时，不只会建 `MCPTool`，还会把资源列表、资源读取工具、prompts 甚至 MCP skills 一起纳入本地运行时。
- 对 Claude Code 来说，一个 server 代表的是一片能力世界，不是一个孤零零的函数表。

## 普通做法
- 普通做法往往只盯住 tools，因为“可调用函数”最容易展示，也最像传统 API 接入。
- 资源、提示词和 server 侧技能经常被当成次要附属品。

## 为什么不用
- Claude Code 没只收工具，是因为模型和用户面对的不是纯调用关系，还包括“我能读什么资源、能套用什么 prompt、能不能直接触发一种技能化工作流”。
- 如果只接工具，MCP server 提供的半个世界都会被白白丢掉。

## 代价
- 代价是 server 接入面更宽，刷新和缓存也更复杂。
- 但这正是它比“单纯接口调用”更完整的地方：它接的是整个能力簇。
