---
title: "reorderMessagesInUI 承认程序顺序和人类顺序不是一回事"
slug: "11-07-03-reordermessagesinui"
date: 2026-04-09
topics: [终端界面]
summary: "`reorderMessagesInUI()` 体现的是一种很成熟的产品判断: 最适合程序记账的顺序, 不一定最适合人阅读。Claude Code 在这里没有崇拜原始日志, 而是承认“人要看懂一轮动作..."
importance: 1
---

# reorderMessagesInUI 承认程序顺序和人类顺序不是一回事

`reorderMessagesInUI()` 体现的是一种很成熟的产品判断: 最适合程序记账的顺序, 不一定最适合人阅读。Claude Code 在这里没有崇拜原始日志, 而是承认“人要看懂一轮动作”比“屏幕机械复述数组顺序”更重要。

## 实现链

真正的重排逻辑写在 `src/utils/messages.ts` 的 `reorderMessagesInUI()` 里。它先按 `toolUseID` 收集四类东西: `tool_use`、`PreToolUse` hooks、`tool_result`、`PostToolUse` hooks, 然后在第二遍重建时按“工具调用 -> 前置 hook -> 工具结果 -> 后置 hook”的顺序吐回列表。`Messages.tsx` 再把这份重排后的结果交给 `applyGrouping()`、各种 collapse 逻辑和 divider 逻辑继续处理, 所以消息区看到的其实是一条被整理过的叙事链, 不是底层数组裸奔。

## 普通做法

更常见的聊天界面会直接按消息数组顺序 `map(render)`。最多在单行组件里临时判断要不要加样式, 但不会先在渲染前重组整条消息链。

## 为什么不用

Claude Code 没选这种“原样回放”, 因为它的消息不是单纯的人类对话, 里面混着工具调用、工具结果、前后置 hooks、brief 过滤和流式更新。要是还坚持谁先 append 谁先显示, 一次工具调用会被拆散在好几处, 人要自己在屏幕上重新拼因果关系。这里先替人重排, 本质上是在把“程序的记账顺序”翻译成“人能读懂的工作顺序”。

## 代价

代价是消息区不再是轻薄渲染层, 而是一层真正的编排器。调试时如果看到顺序和原始 transcript 不同, 你不能只盯着消息数组, 还得回头看 `reorderMessagesInUI()` 和后续 grouping/collapse 政策, 理解成本会明显高一点。
