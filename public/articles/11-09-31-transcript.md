---
title: "长 transcript 到了虚拟化边界就先收手，说明可用性比全量真实更重要"
slug: "11-09-31-transcript"
date: 2026-04-09
topics: [终端界面]
summary: "REPL 在 transcript 分支里只要 virtualScrollActive 成立，就把 Messages 交给 VirtualMessageList，而不是继续走老的全量 cap 路线。这..."
importance: 1
---

# 长 transcript 到了虚拟化边界就先收手，说明可用性比全量真实更重要

## 实现链
REPL 在 transcript 分支里只要 virtualScrollActive 成立，就把 Messages 交给 VirtualMessageList，而不是继续走老的全量 cap 路线。这样一到虚拟化边界，列表就直接换成可滚动的阅读模式。

## 普通做法
普通实现会在 transcript 变长后继续堆消息、继续加 cap，直到列表再也挂不动。那样的“真实”很快就会把可用性一起拖垮。

## 为什么不用
这里先收手，是因为长会话最怕的不是不够真实，而是已经真实到没人能用。可用性必须压过把每条消息都原样挂住的执念。

## 代价
代价是渲染路径不再只有一种，调试时必须区分虚拟与非虚拟两条轨。好处是 transcript 真长起来时，系统仍然能继续读、继续搜、继续跳。
