---
title: "useSyncExternalStore 说明界面是在订阅外部现实不是自造现实"
slug: "11-03-07-usesyncexternalstore"
date: 2026-04-09
topics: [终端界面]
summary: "这里用 `useSyncExternalStore` 很关键。React 在这套系统里不是状态本体，而是订阅者。真正的事实住在外部 store，组件只是按切片取用并响应变化。 这种关系让终端界面更像运..."
importance: 1
---

# useSyncExternalStore 说明界面是在订阅外部现实不是自造现实

这里用 `useSyncExternalStore` 很关键。React 在这套系统里不是状态本体，而是订阅者。真正的事实住在外部 store，组件只是按切片取用并响应变化。

这种关系让终端界面更像运行时面板，而不是一堆各自藏状态的小组件。Claude Code 先承认现实在外，再谈界面怎样表现它。

## 实现链

`useAppState()` 和 `useAppStateMaybeOutsideOfProvider()` 最后都落到 `useSyncExternalStore()`，订阅的是 `store.subscribe`，读取的是 `store.getState()`。React 组件不是现实源头，只是外部 store 的订阅者。

## 普通做法

更普通的 React 状态写法，是让组件树自己用 `useState` 或 `useReducer` 持有现实，context 只是把这份内部 state 往下传。

## 为什么不用

Claude Code 不这么写，是因为它还有 settings watcher、mailbox、远端回灌这些不活在 React 生命周期里的输入。现实既然本来就在外面，组件就不该假装自己才是源头。

## 代价

代价是调试思路也要跟着变：你不能只问“哪个组件 setState 了”，还得问“哪个外部事实推动了 store 变化”。
