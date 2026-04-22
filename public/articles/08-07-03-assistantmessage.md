---
title: "工程取舍：为什么用「人工拼装的 AssistantMessage」而不是新类型？"
slug: "08-07-03-assistantmessage"
date: 2026-04-09
topics: [远端与边界]
importance: 1
---

# 工程取舍：为什么用「人工拼装的 AssistantMessage」而不是新类型？

## 一个"感觉不对"的设计

初次看到 `createSyntheticAssistantMessage` 时，直觉上会觉得不对：

```typescript
export function createSyntheticAssistantMessage(
  request: SDKControlPermissionRequest,
  requestId: string,
): AssistantMessage {
  return {
    type: 'assistant',
    message: {
      id: `remote-${requestId}`,
      role: 'assistant',       // ← 这条消息不是 assistant 产生的
      content: [{
        type: 'tool_use',
        id: request.tool_use_id,
        name: request.tool_name,
        input: request.input,
      }],
      model: '',               // ← 空字符串，因为没有模型
      usage: { input_tokens: 0, output_tokens: 0, ... },  // ← 零，因为没有真实用量
    },
  }
}
```

`role: 'assistant'` 和 `model: ''` 放在一起，看起来像是类型在撒谎——它声称是 assistant 消息，但实际上来自远端的权限请求。

为什么不引入一个 `RemotePermissionRequest` 类型，诚实地表达它的来源？

## 审批链依赖的结构

`ToolUseConfirm` 组件（本地审批 UI）的接口：

```typescript
interface ToolUseConfirmProps {
  assistantMessage: AssistantMessage
  tool: Tool
  onAllow: () => void
  onDeny: () => void
}
```

它依赖的是 `AssistantMessage`——一个有 `content` 数组、`content[0].type === 'tool_use'` 的对象。组件内部会读取 `content[0].name`（工具名）、`content[0].input`（工具参数）来渲染审批界面。

这个组件不关心这个 `AssistantMessage` 是怎么来的——是本地 Claude 模型真实生成的，还是从远端权限请求合成的。它只关心格式符合接口。

## 引入新类型的代价

如果引入 `RemotePermissionRequest` 类型：

```typescript
interface RemotePermissionRequest {
  type: 'remote_permission_request'
  requestId: string
  toolName: string
  toolUseId: string
  input: Record<string, unknown>
}
```

那么 `ToolUseConfirm` 需要修改：

```typescript
// 原来
interface ToolUseConfirmProps {
  assistantMessage: AssistantMessage
  // ...
}

// 修改后
interface ToolUseConfirmProps {
  assistantMessage: AssistantMessage | RemotePermissionRequest
  // ...
}
```

然后组件内部所有访问 `assistantMessage.content[0]` 的地方，都需要先判断类型：

```typescript
const toolUse = isAssistantMessage(message)
  ? message.message.content[0]
  : { name: message.toolName, input: message.input }
```

这个改动会扩散到所有使用 `ToolUseConfirm` 的地方，以及所有处理"正在等待审批的 assistant message"的逻辑——审批历史展示、审批结果关联、审批超时处理……

## 局部谎言换全局复用

`createSyntheticAssistantMessage` 的设计是一种"局部谎言换全局复用"的工程哲学：

- **局部谎言**：`model: ''`、`usage` 全零、`role: 'assistant'` 对应的不是真实的 assistant 动作
- **全局复用**：整条审批链（`ToolUseConfirm`、审批历史、超时处理）不需要任何修改

这个"谎言"是透明的——注释里明确写了：

> Create a synthetic AssistantMessage for remote permission requests. The ToolUseConfirm type requires an AssistantMessage, but in remote mode we don't have a real one.

读代码的人知道这是合成的，知道为什么这样做。透明的谎言不是欺骗，而是一种接口适配。

## 设计模式的角度

从设计模式的角度，这是**Adapter 模式**的一个特殊变体：

传统 Adapter：把 A 类型的接口适配成 B 类型的接口，中间有一层 Adapter 类。

这里的变体：`createSyntheticAssistantMessage` 不是一个 Adapter 类，而是一个"数据形状转换函数"，直接产出 B 类型（`AssistantMessage`），而不是通过 Adapter 类代理。

这更轻量——没有额外的类层次，只有一个函数。代价是产出的对象"看起来像 B 类型，但不完全是真实的 B 类型"。

## 边界标记

为了让这个合成的来源可追踪，`id` 字段使用了 `remote-{requestId}` 的前缀：

```typescript
id: `remote-${requestId}`
```

这不是强制的类型标记，而是一个约定俗成的前缀——调试时可以通过 ID 识别出"这个 AssistantMessage 来自远端权限请求，不是本地模型输出"。

## 面试指导

"何时应该引入新类型，何时应该复用现有类型"是一个没有标准答案的工程问题。

判断框架：

1. **复用的代价**：需要在类型上"撒谎"（字段填空值/零值）有多严重？会不会导致真实的 bug？
2. **引入新类型的代价**：需要修改多少处现有代码？会不会引入新的维护负担？
3. **透明度**：如果选择复用（局部谎言），是否通过注释/命名明确标注了这个妥协？

Claude Code 的判断是：`model: ''` 不会导致 bug（`ToolUseConfirm` 不使用 `model` 字段），而引入新类型需要修改整条审批链。因此选择了复用，并通过函数命名（`createSynthetic...`）和注释明确标注。

这是一个可以辩论的决策，但不是一个草率的决策。
