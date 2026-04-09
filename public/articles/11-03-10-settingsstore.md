---
title: "settings 变化通过统一入口进 store 说明配置风向不该由组件各收各的"
slug: "11-03-10-settingsstore"
date: 2026-04-09
topics: [终端界面]
summary: "设置变化不是让每个组件各自监听，而是通过 `useSettingsChange(onSettingsChange)` 统一打进 store，再由状态层往外扩散。这样配置风向改变时，界面不会变成一群零散..."
importance: 1
---

# settings 变化通过统一入口进 store 说明配置风向不该由组件各收各的

设置变化不是让每个组件各自监听，而是通过 `useSettingsChange(onSettingsChange)` 统一打进 store，再由状态层往外扩散。这样配置风向改变时，界面不会变成一群零散风向标。

它仍然只有一个共同现实入口。谁来决定世界变了，先在状态层说清楚，再让组件各自响应。

## 实现链

`AppStateProvider` 通过 `useSettingsChange(onSettingsChange)` 监听外部设置，再把变化交给 `applySettingsChange(source, store.setState)` 统一写回 store。配置风向先通过一个入口进共同现实，再由组件各自响应。

## 普通做法

更普通的做法，是谁关心哪个设置就自己读一遍、自己监听一遍，组件各自对着配置文件起反应。

## 为什么不用

Claude Code 不让组件各收各的，是因为设置会改写权限、模型、提示和远端行为。分散监听最大的风险不是多写几行，而是每个组件接到变化的时机和翻译方式都不一样。

## 代价

代价是 `applySettingsChange` 这种适配层会比较厚，配置变化得先翻译一次才能进 store；但它至少保住了配置只从一个门进来。
