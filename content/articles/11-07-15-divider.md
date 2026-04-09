---
title: "divider 做成独立兄弟节点，说明局部开关不该拖所有消息重算"
slug: "11-07-15-divider"
date: 2026-04-09
topics: [终端界面]
summary: "`Messages.tsx` 把 unseen divider 和消息行拆成两个兄弟节点，同时把 `MessageActionsSelectedContext.Provider` 放在 divider..."
importance: 1
---

# divider 做成独立兄弟节点，说明局部开关不该拖所有消息重算

## 实现链
`Messages.tsx` 把 unseen divider 和消息行拆成两个兄弟节点，同时把 `MessageActionsSelectedContext.Provider` 放在 divider 分支前面，确保分界线和选中态变化不会顺手把所有消息行一起重算。

## 普通做法
普通列表如果要加一条分界线，常会把它和整组消息绑死在一起，导致一个局部开关也要整组跟着刷新。

## 为什么不用
Claude Code 更在乎局部变化的边界。新消息来了，分界线变一下就够了，不该把整个消息树都拉进来一起算。

## 代价
代价是渲染结构更讲究，读起来没有“一个组件画完所有东西”那么顺。好处是局部更新更轻，长列表也更稳。
