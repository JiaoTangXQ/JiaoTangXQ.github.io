---
title: "normalizeMessages 先统一消息世界，再谈渲染"
slug: "11-07-02-normalizemessages"
date: 2026-04-09
topics: [终端界面]
summary: "`normalizeMessages()` 会把 assistant 和 user 的多块内容拆成单块消息，再用 `deriveUUID()` 补稳定 id；`isNewChain` 让同一条原消息拆..."
importance: 1
---

# normalizeMessages 先统一消息世界，再谈渲染

## 实现链
`normalizeMessages()` 会把 assistant 和 user 的多块内容拆成单块消息，再用 `deriveUUID()` 补稳定 id；`isNewChain` 让同一条原消息拆出来的后续块还能保持顺序。系统、progress、attachment 这些不需要拆的类型会原样保留，后面的编排逻辑拿到的是更规整的消息世界。

## 普通做法
普通列表通常接受什么就展示什么，最多在组件内部临时判断数组里有几块内容、该不该换行、该不该合并。

## 为什么不用
Claude Code 后面还要做重排、分组、折叠、搜索和虚拟化。若不先归一，后面的规则就得同时理解“消息级”和“块级”两套世界，`tool_use` 和 `tool_result` 也很难稳定对上号。先拆平，是为了让后续每一步都只面对一种形状。

## 代价
代价是原始消息的外形会被打散，源码里看起来不像“直写直画”。但换来的好处是每个块都有稳定身份，后面的排序、搜索、分界线和点击逻辑都能站在同一层上工作。
