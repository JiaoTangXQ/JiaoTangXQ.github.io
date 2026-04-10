---
title: "协议设计：control_request 和 control_response 的消息流是怎样的？"
slug: "08-07-01-assistant-tool-use"
date: 2026-04-09
topics: [远端与边界]
summary: "control_request（服务端发起的权限请求）和 control_response（客户端的审批结果）构成了 Bridge 协议里唯一一段双向同步的「问答流」——消息结构、超时语义、request_id 的作用域，决定了这套机制的可靠性边界。"
importance: 1
---

# 协议设计：control_request 和 control_response 的消息流是怎样的？

## 单向 vs 双向

Bridge 协议里大多数消息是单向的：

- 本地 → 远端：用户输入（user 消息）
- 远端 → 本地：Claude 输出（assistant 消息）、工具执行进度

但有一类消息是双向同步的：**权限审批**。

远端需要执行一个有风险的操作 → 请求本地用户批准 → 等待本地响应 → 继续或中止

这个"问-答"模式由 `control_request` 和 `control_response` 实现。

## control_request 的结构

```typescript
interface SDKControlRequest {
  type: 'control_request'
  request_id: string          // 唯一标识，用于配对响应
  request: {
    subtype: 'permission_request' | 'initialize' | 'set_model' | ...
    // permission_request 时包含：
    tool_use_id: string
    tool_name: string
    input: Record<string, unknown>
    description?: string
    permission_suggestions?: PermissionUpdate[]
  }
}
```

`request_id` 是关键字段：它是这次问答的"会话号"。响应必须带上同一个 `request_id`，服务端才能把响应和原始请求配对。

注释里提到了超时语义：

> Must respond promptly or the server kills the WS (~10-14s timeout).

如果本地在 10-14 秒内没有发回 `control_response`，服务端会关闭 WebSocket 连接。这意味着：**审批 UI 不能阻塞太久**，必须有明确的超时或默认行为。

## control_response 的发送路径

本地用户点击"允许"或"拒绝"后，响应经过：

```
ToolUseConfirm UI（用户操作）
  ↓
BridgePermissionCallbacks.sendResponse(requestId, response)
  ↓
bridgeApi.sendPermissionResponseEvent(sessionId, event, sessionToken)
  ↓
HTTP POST /v1/sessions/{sessionId}/events
    body: { events: [{ type: 'control_response', ... }] }
  ↓
服务端将响应路由到对应的 control_request
```

注意：`control_request` 通过 **WebSocket（SSE）** 到达本地，但 `control_response` 通过 **HTTP POST** 发回。这是有意的不对称设计：

- 入站：长连接推送（WebSocket/SSE），实时性好
- 出站：HTTP POST，幂等、可重试

HTTP POST 的好处是：如果发送失败（网络抖动），可以直接重试同一条请求，而不用担心副作用——服务端基于 `request_id` 做幂等处理。

## 合成 AssistantMessage 的作用

本地的审批 UI（`ToolUseConfirm`）要求：

```typescript
type ToolUseConfirmProps = {
  assistantMessage: AssistantMessage  // 包含 tool_use 的消息
  tool: Tool
  onAllow: () => void
  onDeny: () => void
}
```

但远端发来的 `control_request` 不是 `AssistantMessage`，它是一个独立的控制消息。

`createSyntheticAssistantMessage` 把 `control_request` 包装成 `AssistantMessage`：

```typescript
export function createSyntheticAssistantMessage(
  request: SDKControlPermissionRequest,
  requestId: string,
): AssistantMessage {
  return {
    type: 'assistant',
    uuid: randomUUID(),
    message: {
      id: `remote-${requestId}`,      // 用 requestId 作为 ID，保证唯一性
      content: [{
        type: 'tool_use',
        id: request.tool_use_id,
        name: request.tool_name,
        input: request.input,
      }],
      // 模型字段填空字符串——这不是真实模型输出，只是结构满足
      model: '',
      // 用量统计填零
      usage: { input_tokens: 0, output_tokens: 0, ... },
    },
  }
}
```

这是一个"协议桥接"模式：把 A 协议的消息格式（`SDKControlRequest`）转成 B 系统期望的格式（`AssistantMessage`），让 B 系统（本地审批 UI）不需要知道这条消息来自远端。

## cancelRequest 的超时保障

权限审批有一个被动超时：服务端在 10-14 秒内没收到响应，会关闭 WebSocket。

还有一个主动取消路径：本地会话断线时，`BridgePermissionCallbacks.cancelRequest` 会被调用：

```typescript
/** Cancel a pending control_request so the web app can dismiss its prompt. */
cancelRequest(requestId: string): void
```

这个调用通知 Web 端关闭已经没有意义的审批弹窗。否则用户在 claude.ai 上会看到一个弹窗，会话底层已经断了，但弹窗还在等待点击。

## request_id 的生命周期

`request_id` 的有效期和会话绑定：

1. 服务端生成 `request_id`，发送 `control_request`
2. 本地把 `request_id → callback` 存入 Map
3. 用户审批，本地发 `control_response`（带 `request_id`）
4. 服务端响应，`request_id` 作废
5. 会话断线，所有 pending 的 `request_id` 被清理

`request_id` 不能跨会话复用——一旦会话断线重连，之前的 `request_id` 全部失效。这是正确的设计：重连后的会话状态可能已经改变，旧的权限请求是否还有效，服务端无法保证，因此必须重新发起。

## 面试指导

"如何设计一个双向同步的问答协议"在分布式系统面试里不常见，但很有深度。

关键要点：

1. **请求-响应配对**：`request_id` 是配对的核心，必须在整个生命周期内唯一
2. **超时处理**：问答不能无限等待，服务端侧超时 + 客户端侧 cancel，双重保障
3. **传输协议的不对称**：问（SSE/WebSocket）vs 答（HTTP POST），各自有优势
4. **生命周期绑定**：request 的有效期必须和外层 session 的生命周期绑定，session 失效时 request 自动失效

这个设计的精妙之处在于：它让"等待用户审批"这个操作，对本地 UI 是透明的——UI 只看到一个 `AssistantMessage`，完全不知道这条消息是合成的，来自远端的权限请求。
