---
title: "点击展开要按 tool_use_id 把同一组绑住，说明虚拟化下不该只认单条消息"
slug: "11-09-33-tool-use-id"
date: 2026-04-09
topics: [终端界面]
summary: "expandKey 会优先取 tool_use_id，让 tool_use 和它对应的 tool_result 共用同一个展开键。这样在 VirtualMessageList 里点一次，语义上属于同一..."
importance: 1
---

# 点击展开要按 tool_use_id 把同一组绑住，说明虚拟化下不该只认单条消息

## 实现链
expandKey 会优先取 tool_use_id，让 tool_use 和它对应的 tool_result 共用同一个展开键。这样在 VirtualMessageList 里点一次，语义上属于同一组的两行会一起展开。

## 普通做法
普通实现会把每一条消息都看成独立节点，点击哪条就只翻哪条。那在工具调用这种成对结构里，用户会看到同一组内容被拆开操作。

## 为什么不用
这里不该只认单条消息，因为 tool_use 和 tool_result 本来就是一个动作的两个面。按 tool_use_id 绑在一起，才符合虚拟化下的真实阅读单位。

## 代价
代价是展开状态的键不再只是 uuid，逻辑上也要接受跨行联动。好处是组装出来的工具调用更像一段连续故事，而不是两条互不相干的行。
