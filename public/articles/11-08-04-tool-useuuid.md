---
title: "流式 tool use 也先拿稳定 UUID，说明活消息不能没有固定身份"
slug: "11-08-04-tool-useuuid"
date: 2026-04-09
topics: [终端界面]
summary: "`Messages.tsx` 会先把还在流的 `streamingToolUses` 过滤掉已经进入 `inProgressToolUseIDs` 或 `normalizedToolUseIDs` 的..."
importance: 1
---

# 流式 tool use 也先拿稳定 UUID，说明活消息不能没有固定身份

## 实现链
`Messages.tsx` 会先把还在流的 `streamingToolUses` 过滤掉已经进入 `inProgressToolUseIDs` 或 `normalizedToolUseIDs` 的项，再用 `createAssistantMessage` 包一层 synthetic assistant 消息，最后把 `streamingToolUse.contentBlock.id` 交给 `deriveUUID(..., 0)`。`deriveUUID` 本身只是保留父 UUID 的前 24 位，再拼上内容块索引，但这一步足够让同一个正在生成的 tool use 在每次重算时都拿到同一个 React key。

## 普通做法
更普通的做法，是在每次流式增量到来时直接给新行一个随机 key，或者干脆按数组位置编号。那样实现最快，但会把“同一个正在完成的工具调用”当成一批不同的临时对象。

## 为什么不用
`streamingToolUses` 会随着每个 `input_json_delta` 变化，而 React 依赖 key 来判断是不是同一棵子树。若 key 每次都变，界面就会不停 remount，同一个半成品工具调用会像不断换脸，视觉抖动和状态丢失都会跟着来。

## 代价
代价是身份不再是天然发现的，而是由内容块派生出来的。这个约束看起来更“人工”，但它换来的是流式消息在还没定型时也能先有一个稳定的自己。
