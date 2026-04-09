---
title: "skill先是一份带 frontmatter 的工作包"
slug: "07-02-01-skill-frontmatter"
date: 2026-04-09
topics: [扩展系统]
summary: "- `loadSkillsDir.ts` 不是把技能文件当纯文本读进来，而是先跑 `parseFrontmatter`、`parseSkillFrontmatterFields`，把 `descrip..."
importance: 1
---

# skill先是一份带 frontmatter 的工作包

## 实现链
- `loadSkillsDir.ts` 不是把技能文件当纯文本读进来，而是先跑 `parseFrontmatter`、`parseSkillFrontmatterFields`，把 `description`、`allowed-tools`、`when-to-use`、`model`、`agent`、`effort`、`shell` 这些字段拆出来。
- 也就是说，磁盘上的一份 `SKILL.md` 在代码里先被当成“带制度字段的工作包”，正文提示词反而只是其中一部分。

## 普通做法
- 更普通的做法是把技能当成一段提示词模板，只有在用户触发时才把全文塞给模型。
- 这种做法写起来简单，作者只需要会写 Markdown，不需要理解额外 schema。

## 为什么不用
- Claude Code 没这么做，因为它想让技能在“执行前”就能被系统理解。比如帮助列表要显示用途，权限系统要知道允许哪些工具，调度层还要知道它是不是 user-invocable、是不是要走 agent 或 shell。
- 如果技能只是大段文本，这些制度判断就只能靠模型临场猜，系统本身就失去控制力了。

## 代价
- 代价是技能作者要学 frontmatter，错误配置还得走解析和校验路径。
- 但这笔复杂度换来的是技能不再只是“会说话的文案”，而是能被运行时提前看懂的工作单元。
