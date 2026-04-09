---
title: "tool use 和 tool result 共用展开键，说明界面承认它们本来就是一件事"
slug: "11-08-05-tool-usetool-result"
date: 2026-04-09
topics: [终端界面]
summary: "`Messages.tsx` 的 `expandKey(msg)` 会尽量从 assistant 或 user 消息里取 `tool_use_id`，只有拿不到时才退回 `uuid`。这意味着一次工具..."
importance: 1
---

# tool use 和 tool result 共用展开键，说明界面承认它们本来就是一件事

## 实现链
`Messages.tsx` 的 `expandKey(msg)` 会尽量从 assistant 或 user 消息里取 `tool_use_id`，只有拿不到时才退回 `uuid`。这意味着一次工具请求和它的结果虽然被渲染成两行，但展开状态是按同一个键存进 `expandedKeys` 的。配合 `buildMessageLookups` 提供的 `toolUseByToolUseID` 和 `toolResultByToolUseID`，`MessageRow`、`UserToolResultMessage` 和工具结果组件都能把两半拼回同一次动作。

## 普通做法
更普通的做法，是让每一行自己决定自己能不能展开，或者干脆按显示顺序单独记状态。这样不用碰跨行的身份映射，但也把一次工具调用拆成了两份互不相干的折叠状态。

## 为什么不用
工具请求和工具结果在数据上就是同一个 `tool_use_id` 的前后两面。若展开键不合并，用户展开的就只是其中一半，看到的会是碎片化的动作，而不是完整的执行过程。

## 代价
展开状态不再只属于某个可见行，而是跟着一个更抽象的工具身份走。这个状态模型更绕一点，但它更符合一次工具调用的真实边界。
