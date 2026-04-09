---
title: "settings先解决的是谁有资格定义规则"
slug: "06-07-01-settings"
date: 2026-04-09
topics: [治理与权限]
summary: "这一页重点看“settings先解决的是谁有资格定义规则”。对应源码主要是 `src/utils/settings/settings.ts`、`src/utils/settings/validatio..."
importance: 1
---

# settings先解决的是谁有资格定义规则

## 实现链

这一页重点看“settings先解决的是谁有资格定义规则”。对应源码主要是 `src/utils/settings/settings.ts`、`src/utils/settings/validation.ts`。
这一章真正落在 `settings.ts`、`validation.ts`、`changeDetector.ts`、`applySettingsChange.ts` 这条设置装配链上。Claude Code 把 settings 当成制度来源和制度变更入口：先验证谁能定义规则，再拦截变化、清缓存、扇出通知，最后把运行时的权限、hooks 和状态同步过去。

## 普通做法

更普通的做法，是把设置文件当静态配置：读一次，改了就整个 reload，谁写的、改了什么、该通知谁都交给监听器自己解决。

## 为什么不用

Claude Code 没采用这种轻量路线，因为它的设置不仅决定显示偏好，还会重写权限、hooks、插件和模式。要是变化不能先被识别和编排，多个监听者就会各自重算，制度现实也会在同一次变更里短暂分裂。

## 代价

这样做的好处是设置变化更像一次正式立法程序，传播路径清楚。代价是设置系统本身变成了运行时基础设施，而不再只是“读个 JSON”那么简单。
