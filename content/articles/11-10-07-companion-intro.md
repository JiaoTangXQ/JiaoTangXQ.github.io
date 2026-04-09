---
title: "companion intro 只介绍一次，说明体验层也要避免反复自我介绍"
slug: "11-10-07-companion-intro"
date: 2026-04-09
topics: [终端界面]
summary: "`buddy/prompt.ts` 里的 `getCompanionIntroAttachment(messages)` 会先检查 `companionMuted` 和当前 companion 是否存..."
importance: 1
---

# companion intro 只介绍一次，说明体验层也要避免反复自我介绍

## 实现链

`buddy/prompt.ts` 里的 `getCompanionIntroAttachment(messages)` 会先检查 `companionMuted` 和当前 companion 是否存在，再扫描 `messages` 里是否已经出现过同名的 `companion_intro`。`utils/messages.ts` 之后把这条附件包装成系统提醒，送给主模型一次。

## 普通做法

普通做法会在每轮都重复介绍角色设定，生怕模型忘了。那样看似认真，其实是在不断污染上下文。

## 为什么不用

Claude Code 只介绍一次，是因为体验层也要懂礼貌，知道什么地方该停。角色说明应该进结构记忆，而不是靠反复唠叨续命。

## 代价

代价是实现里要多一个“这份介绍是不是已经发过”的检查。好处是 companion 的身份不会在每轮里被重复敲一遍。
