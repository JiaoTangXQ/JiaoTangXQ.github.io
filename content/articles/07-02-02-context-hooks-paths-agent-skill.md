---
title: "context、hooks、paths、agent 说明 skill 会改写工作方式"
slug: "07-02-02-context-hooks-paths-agent-skill"
date: 2026-04-09
topics: [扩展系统]
summary: "- `parseSkillPaths` 会把 frontmatter 里的 `paths` 变成作用域限制，`parseHooksFromFrontmatter` 会解析 hooks，另外 `exec..."
importance: 1
---

# context、hooks、paths、agent 说明 skill 会改写工作方式

## 实现链
- `parseSkillPaths` 会把 frontmatter 里的 `paths` 变成作用域限制，`parseHooksFromFrontmatter` 会解析 hooks，另外 `executionContext`、`agent`、`shell`、`allowed-tools` 等字段一起决定这份技能进入系统后会改写哪些工作方式。
- 换句话说，skills 不只是在说“该做什么”，还在告诉 Claude Code 这件事应该在哪个目录里做、能动哪些工具、是否要 fork agent、是否要先跑 shell。

## 普通做法
- 普通做法通常只把技能理解成一段提示词，顶多加一点参数替换。
- 在那种体系里，目录边界、前后钩子和执行上下文大多交给用户自己记，或者交给模型自己猜。

## 为什么不用
- Claude Code 不敢只靠模型猜，因为代码库、权限和执行环境都是真实副作用世界。`paths` 不收紧，技能就可能在错误目录下工作；hooks 不显式声明，外围制度就没法稳定介入。
- 从代码结构看，这更像是在把“经验”编成一套可检查、可限制的行动方式，而不是一段漂亮的文字。

## 代价
- 代价是技能的心智模型明显更重，新手第一次看会觉得像是在写迷你配置语言。
- 但这也是它值钱的地方：它把本来藏在高手脑子里的操作纪律，前移成了系统能执行的边界。
