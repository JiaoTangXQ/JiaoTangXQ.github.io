---
title: "prompts和skills不是同一来源，说明收编世界也要先分清血缘"
slug: "07-08-04-promptsskills"
date: 2026-04-09
topics: [扩展系统]
summary: "- MCP prompts 来自 server 的 `listPrompts`，而 MCP skills 则是 Claude Code 侧用 `mcpSkillBuilders.ts` 把另一类描述翻..."
importance: 1
---

# prompts和skills不是同一来源，说明收编世界也要先分清血缘

## 实现链
- MCP prompts 来自 server 的 `listPrompts`，而 MCP skills 则是 Claude Code 侧用 `mcpSkillBuilders.ts` 把另一类描述翻译成 `Command`。它们在界面上可能都像“可直接用的能力入口”，但代码来源完全不同。
- 也正因为来源不同，缓存、校验和行为边界也不能偷懒混在一起。

## 普通做法
- 更省事的办法是把 prompts 和 skills 都叫模板，统一塞进一个列表，让用户自己别管差别。
- 这样产品表面很整齐。

## 为什么不用
- Claude Code 没这么抹平，是因为 prompts 更像 server 直接给的运行时模板，而 skills 是 Claude Code 这边要纳入命令制度的对象。
- 如果血缘不分清，后面谁该走 frontmatter 规则、谁该跟资源刷新联动、谁能被当 slash command 用，都会混乱。

## 代价
- 代价是用户会看到两个长得相似、但来源不同的概念。
- 不过这种不完全统一，比错误统一更安全。
