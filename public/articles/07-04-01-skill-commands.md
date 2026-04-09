---
title: "新 skill 和旧 commands 并存，是在给生态迁移搭桥"
slug: "07-04-01-skill-commands"
date: 2026-04-09
topics: [扩展系统]
summary: "- `loadSkillsDir.ts` 的 `LoadedFrom` 里还保留了 `commands_DEPRECATED`，说明旧式 command 目录并没有被粗暴删掉。Claude Code ..."
importance: 1
---

# 新 skill 和旧 commands 并存，是在给生态迁移搭桥

## 实现链
- `loadSkillsDir.ts` 的 `LoadedFrom` 里还保留了 `commands_DEPRECATED`，说明旧式 command 目录并没有被粗暴删掉。Claude Code 现在是让新技能和旧 commands 同时存在，再慢慢把生态往新结构迁。
- 这不是文档上的“兼容一下”，而是代码里实打实保留了两套来源，并让它们都能进入同一个命令装配过程。

## 普通做法
- 一种更常见的做法是新系统上线时直接废掉旧格式，让用户自己迁移。
- 短期看这最干净，代码也不会一直背兼容逻辑。

## 为什么不用
- Claude Code 没有一次性切断旧 command，主要是因为它面对的不是一个内部小工具，而是已经有用户、有插件生态的运行时。
- 如果直接硬切，旧命令、旧文档和旧工作流会一起失效；从代码结构看，它更愿意多背一段迁移桥，也不愿把升级做成一次性断崖。

## 代价
- 代价就是装配层会更脏，新旧来源共存意味着名字冲突、行为差异和帮助信息都要额外处理。
- 这未必是“最优雅”的方案，但在生态迁移期通常更现实。
