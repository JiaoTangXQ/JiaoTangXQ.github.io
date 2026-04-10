---
title: "expandKey 用 tool_use_id：工具调用和结果是一个展开单元"
slug: "11-09-33-tool-use-id"
date: 2026-04-09
topics: [终端界面]
summary: "VirtualMessageList 里，expandKey 优先取 tool_use_id，让 tool_use 和对应的 tool_result 共用同一个展开/折叠状态。点一次展开两行，因为它们语义上属于同一个动作。"
importance: 1
---

# expandKey 用 tool_use_id：工具调用和结果是一个展开单元

`VirtualMessageList` 里消息的展开/折叠状态存在 `expandedKeys`（一个 Set）里。每条消息的展开键（`expandKey`）优先取 `tool_use_id`。

```typescript
const expandKey = message.tool_use_id ?? message.uuid;
```

## 为什么两条消息共用一个展开键

`tool_use` 消息代表「助手要求执行某个工具」，`tool_result` 消息代表「工具执行返回了什么」。这两条消息有同一个 `tool_use_id`，因为它们是同一次工具调用的两个面。

如果它们有独立的展开键，用户点击展开 `tool_use`，`tool_result` 仍然是折叠状态。用户想看完整的工具调用，需要点两次——先展开调用，再展开结果。

用 `tool_use_id` 共享展开状态后，点一次展开 `tool_use`，对应的 `tool_result` 也自动展开；再点一次，两者同时折叠。一次操作，一个展开单元，符合「这是同一件事」的语义。

## 展开单元的语义边界

什么叫「一个展开单元」？取决于什么东西在语义上属于同一个可理解的块。

文本消息：一条消息就是一个单元，用消息 UUID 作为展开键。

工具调用：`tool_use` + `tool_result` 合起来是一个单元（一次工具调用的完整过程），用 `tool_use_id` 作为展开键。

这个设计让展开/折叠操作的粒度和用户的实际理解粒度对齐：用户在理解「这次工具调用」，不是在分别理解「这条 tool_use 消息」和「那条 tool_result 消息」。操作的粒度应该和理解的粒度一致。
