---
title: "sticky prompt 重新落回的位置先找最近可见锚点，说明召回也要尽量少挪视野"
slug: "11-09-30-sticky-prompt"
date: 2026-04-09
topics: [终端界面]
summary: "StickyTracker 从 firstVisible 往回扫时，会先找最近的可用 prompt，再跳过已经贴到视口顶边的那条。这样 header 回落时会优先贴近当前视野，而不是硬追到更远的历史。..."
importance: 1
---

# sticky prompt 重新落回的位置先找最近可见锚点，说明召回也要尽量少挪视野

## 实现链
StickyTracker 从 firstVisible 往回扫时，会先找最近的可用 prompt，再跳过已经贴到视口顶边的那条。这样 header 回落时会优先贴近当前视野，而不是硬追到更远的历史。

## 普通做法
普通实现可能会直接用当前 prompt 作为回落目标，或者无脑取最老的那条。那样 header 一换，视野就会被强行拉得更远。

## 为什么不用
这里召回也要尽量少挪视野，因为 sticky prompt 的任务只是找回入口，不是替用户改写当前阅读焦点。最近可见锚点最符合这个目标。

## 代价
代价是要额外判断 prompt 是否已经在屏幕边缘附近，逻辑比单纯取最近条更绕。好处是 header 的落点更稳，不会一跳就把眼前内容挤开。
