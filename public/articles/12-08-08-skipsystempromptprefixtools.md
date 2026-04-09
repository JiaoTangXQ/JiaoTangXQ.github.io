---
title: "skipSystemPromptPrefix 和空 tools，说明借模型也先保护浏览器任务口令"
slug: "12-08-08-skipsystempromptprefixtools"
date: 2026-04-09
topics: [外延执行]
summary: "浏览器侧这条推理链在借模型时，并没有把宿主系统里的所有默认前缀和工具都一股脑塞进去。它反而显式跳过通用前缀，还把 `tools` 置空，只为了让这条浏览器任务口令保持干净，不被别的说话习惯搅乱。 这很..."
importance: 1
---

# skipSystemPromptPrefix 和空 tools，说明借模型也先保护浏览器任务口令

浏览器侧这条推理链在借模型时，并没有把宿主系统里的所有默认前缀和工具都一股脑塞进去。它反而显式跳过通用前缀，还把 `tools` 置空，只为了让这条浏览器任务口令保持干净，不被别的说话习惯搅乱。

这很像熟练工程师的手感：能复用模型能力，并不代表要把上下文越堆越多。真正重要的是，让模型在这一小块现场里听到最该听的话。

## 实现链
`callAnthropicMessages` 调 `sideQuery()` 时显式带上 `skipSystemPromptPrefix: true` 和 `tools: []`。注释已经解释原因：lightning prompt 自己是完整的，再叠 CLI 通用前缀会稀释浏览器任务口令；不清空 tools，模型还会吐出函数调用 XML。

## 普通做法
普通做法是复用主查询默认参数，让浏览器任务也吃同一份系统前缀和工具集。

## 为什么不用
Claude Code 不敢偷这个懒，因为这里借模型不是为了通用聊天，而是为了生成一段受控的浏览器行动指令。

## 代价
代价是浏览器侧推理路径会有自己的特例配置，和主 query 参数不再完全一致。

