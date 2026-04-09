---
title: "createSkillCommand 把磁盘经验编译成运行时身份"
slug: "07-03-01-createskillcommand"
date: 2026-04-09
topics: [扩展系统]
summary: "- `loadSkillsDir.ts` 里的 `createSkillCommand` 会把文件路径、frontmatter、正文内容、来源标签和基目录一起组装成 `Command`。这样一份磁盘技..."
importance: 1
---

# createSkillCommand 把磁盘经验编译成运行时身份

## 实现链
- `loadSkillsDir.ts` 里的 `createSkillCommand` 会把文件路径、frontmatter、正文内容、来源标签和基目录一起组装成 `Command`。这样一份磁盘技能一进内存，就已经带上 `loadedFrom`、`baseDir`、`paths`、`userInvocable` 这些运行时身份。
- 这一步很像编译：输入还是 Markdown 文件，输出已经是命令注册表能处理的对象，不需要等到用户真的触发时才现组装。

## 普通做法
- 更容易想到的写法是只保存文件路径，等用户输入命令时再去读文件、再去解析。
- 这样启动时负担更轻，理论上也更懒加载。

## 为什么不用
- Claude Code 没这么写，因为命令系统在触发前就要知道很多东西，比如帮助文本、冲突去重、token 估算、可见性和是否允许用户直接调用。
- 如果一直把技能留成“磁盘上的文件”，那命令层和调度层就得在运行时一边临时读文件，一边临时推断身份，整个系统会更散。

## 代价
- 代价是启动阶段要多做一轮解析和对象构建。
- 但这让后续所有模块面对的是稳定对象，而不是“也许是一段文本、也许是一条路径”的半成品。
