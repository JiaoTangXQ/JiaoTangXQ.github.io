---
title: "技能提示、ToolSearch和工具前缀一起维持同一种语言环境"
slug: "12-07-02-toolsearch"
date: 2026-04-09
topics: [外延执行]
summary: "更巧的是，这里连技能提示、`ToolSearch`、工具前缀和系统提示词都在围绕同一种语言环境工作。模型不是凭空“知道”怎么用浏览器，而是被一步步引到同一套 `mcp__claude-in-chrom..."
importance: 1
---

# 技能提示、ToolSearch和工具前缀一起维持同一种语言环境

更巧的是，这里连技能提示、`ToolSearch`、工具前缀和系统提示词都在围绕同一种语言环境工作。模型不是凭空“知道”怎么用浏览器，而是被一步步引到同一套 `mcp__claude-in-chrome__*` 世界里。

这说明 Claude Code 在浏览器接入上追求的不是神奇感，而是可教、可发现、可复用。系统知道自己怎样把一个新世界翻译进旧秩序里。

## 实现链
`prompt.ts` 一边提供 `CLAUDE_IN_CHROME_SKILL_HINT`，一边提供 `CHROME_TOOL_SEARCH_INSTRUCTIONS`，同时所有浏览器工具名都固定成 `mcp__claude-in-chrome__*`。这说明提示词、ToolSearch 和实际工具名被有意做成同一种语言环境。

## 普通做法
普通做法是只在文档里说“有浏览器工具”，运行时再靠模型自己猜名字。

## 为什么不用
Claude Code 不愿意把这件事交给模型猜，因为浏览器工具是高副作用能力，先把名字、技能和加载方式说一致，比事后补救更稳。

## 代价
代价是 prompt 注入会更长，工具命名也更受约束。

