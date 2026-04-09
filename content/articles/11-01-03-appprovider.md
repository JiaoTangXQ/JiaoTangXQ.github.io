---
title: "根 App 只负责装配 Provider 说明入口层真正职责是交棒"
slug: "11-01-03-appprovider"
date: 2026-04-09
topics: [终端界面]
summary: "根 `App` 薄得几乎不像“主组件”。它只把 `FpsMetricsProvider`、`StatsProvider`、`AppStateProvider` 套起来，再把 `children` 交下..."
importance: 1
---

# 根 App 只负责装配 Provider 说明入口层真正职责是交棒

根 `App` 薄得几乎不像“主组件”。它只把 `FpsMetricsProvider`、`StatsProvider`、`AppStateProvider` 套起来，再把 `children` 交下去，不在顶层抢业务判断。

这很重要。越靠入口，越不该堆具体逻辑，否则所有能力都会在根上打结。Claude Code 把根层做成装配点，而不是决策点。

## 实现链

`App.tsx` 自己几乎不处理业务判断，它只把 `getFpsMetrics`、`stats` 和 `initialState` 分别交给 `FpsMetricsProvider`、`StatsProvider`、`AppStateProvider`，然后把 `children` 继续往下传。根 App 的职责不是亲自干活，而是把不同层的现实源头交到正确容器手里。

## 普通做法

更直觉的写法，是把顶层组件顺手做成“大总管”：既初始化状态，又处理副作用，还顺手拼接界面逻辑。

## 为什么不用

Claude Code 没把根 App 写成大总管，是因为入口层最该做的是交棒。要是顶层自己也开始攒业务逻辑，后面 provider、store 和组件边界就会被重新揉回去。

## 代价

这种写法的代价是入口看起来有点“空”，很多真正的复杂度都被压进别的文件里；第一次读源码的人不容易在根组件看到完整故事。
