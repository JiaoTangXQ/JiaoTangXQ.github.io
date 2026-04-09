---
title: "buildMessageLookups 把分散事件重新织成可读关系"
slug: "11-08-01-buildmessagelookups"
date: 2026-04-09
topics: [终端界面]
summary: "`Messages.tsx` 先把消息做完 `normalizeMessages`、分组、折叠和截断，再把 `normalizedMessages` 和当前要显示的 `messagesToShow` ..."
importance: 1
---

# buildMessageLookups 把分散事件重新织成可读关系

## 实现链
`Messages.tsx` 先把消息做完 `normalizeMessages`、分组、折叠和截断，再把 `normalizedMessages` 和当前要显示的 `messagesToShow` 一起交给 `buildMessageLookups`。这个函数不是单纯建一个表，而是先扫 assistant 消息里的 `tool_use`，建立 `toolUseByToolUseID`、`toolUseIDToMessageID` 和 `siblingToolUseIDs`，再扫 `progress`、`user`、`hook_attachment` 和未收尾的 `server_tool_use` / `mcp_tool_use`，补出 `progressMessagesByToolUseID`、`toolResultByToolUseID`、`resolvedToolUseIDs`、`erroredToolUseIDs`、`inProgressHookCounts` 和 `resolvedHookCounts`。后面的 `MessageRow`、`AssistantToolUseMessage`、`UserToolResultMessage`、`HookProgressMessage` 都是直接读这批 lookup，不再自己猜关系。

## 普通做法
更普通的写法，是让每个行组件自己向前后扫一遍，碰到 `tool_result` 再临时找对应的 `tool_use`，碰到 hook 再数现场出现了几次，碰到 sibling 再从邻居里拼关系。这样看起来省事，但每个消费者都会重复同一套判断。

## 为什么不用
这里不是单条消息自己能说清楚自己的语义。assistant 文本、用户结果、进度消息、hook attachment 和 synthetic streaming 消息会被拆到不同的行里，还可能在流式更新和重排里换位置。靠邻居临时推断，不但容易把同一个工具调用看成几件事，还会把关系判断做成 O(n²)。

## 代价
代价是每次渲染都要先做一轮全量索引，额外维护几张 Map 和 Set。换来的好处是关系不会跟着列表抖，界面读到的是稳定的因果网，而不是一堆临时拼出来的猜测。
