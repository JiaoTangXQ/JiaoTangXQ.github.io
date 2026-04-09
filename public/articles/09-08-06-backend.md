---
title: "先只注册 backend 类，不急着探测环境，说明轻重路径被故意分开"
slug: "09-08-06-backend"
date: 2026-04-09
topics: [多Agent协作]
summary: "Claude Code 连“加载能力”和“真正探测环境”都刻意分成轻重两条路。 `ensureBackendsRegistered()` 只做动态 import，把 `TmuxBackend` 和 `..."
importance: 1
---

# 先只注册 backend 类，不急着探测环境，说明轻重路径被故意分开

Claude Code 连“加载能力”和“真正探测环境”都刻意分成轻重两条路。

## 实现链

`ensureBackendsRegistered()` 只做动态 import，把 `TmuxBackend` 和 `ITermBackend` 类注册进 registry，但不立刻探测环境、不起子进程。真正重的探测留给 `detectAndGetBackend()`。注释明确说这条路是 lightweight option。

## 普通做法

普通做法会在需要 backend 时一步到位：导入、探测、创建实例全一起做。

## 为什么不用

Claude Code 分开，是因为很多时候系统只需要“知道有哪些 backend 类”，并不需要马上去探测终端环境。把轻路径和重路径拆开，可以减少无谓副作用。

## 代价

代价是 registry 设计更抽象，读起来没有“一步到位”那么直观。
