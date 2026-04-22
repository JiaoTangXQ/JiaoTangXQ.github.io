---
title: "MCP transport 层为什么需要六种实现？stdio、SSE、HTTP、WebSocket 的设计差异"
slug: "07-07-08-transport"
date: 2026-04-09
topics: [扩展系统]
importance: 1
---

# MCP transport 层为什么需要六种实现？stdio、SSE、HTTP、WebSocket 的设计差异

## 协议设计问题：为什么不统一用一种 transport？

如果所有 MCP 服务器都用 HTTP REST，会更简单吗？理论上是的——开发者熟悉，工具链成熟，调试方便。

但这样会牺牲什么？

- 本地 MCP 服务器（如代码分析工具）不需要 HTTP 服务器的开销
- IDE 扩展里的 MCP 服务器在同一进程内，HTTP 会带来不必要的序列化/网络开销
- 某些工具需要服务端推送（streaming output），HTTP 请求-响应不够

六种 transport 是对这六种不同约束的务实回应。

---

## 六种 transport 的设计定位

```typescript
export type Transport = 'stdio' | 'sse' | 'sse-ide' | 'http' | 'ws' | 'sdk'
```

**stdio**

```typescript
export const McpStdioServerConfigSchema = lazySchema(() =>
  z.object({
    type: z.literal('stdio').optional(),  // 可选：向后兼容默认值
    command: z.string().min(1, 'Command cannot be empty'),
    args: z.array(z.string()).default([]),
    env: z.record(z.string(), z.string()).optional(),
  }),
)
```

Claude Code 启动一个子进程（如 `npx @modelcontextprotocol/server-filesystem ~/Documents`），通过 stdin/stdout 通信。

适合：本地 MCP 服务器，不需要网络，子进程随 Claude Code 一起启动和退出。这是最常用的本地 MCP 服务器模式。

**sse（Server-Sent Events）**

```typescript
export const McpSSEServerConfigSchema = lazySchema(() =>
  z.object({
    type: z.literal('sse'),
    url: z.string(),
    headers: z.record(z.string(), z.string()).optional(),
    headersHelper: z.string().optional(),
    oauth: McpOAuthConfigSchema().optional(),
  }),
)
```

标准 SSE：HTTP 长连接，服务端可以持续推送事件。支持 headers（用于认证）和 OAuth 配置。

适合：远程 MCP 服务器，服务端需要推送能力（如实时日志流、异步任务进度）。

**sse-ide（IDE 扩展专用 SSE）**

```typescript
// Internal-only server type for IDE extensions
export const McpSSEIDEServerConfigSchema = lazySchema(() =>
  z.object({
    type: z.literal('sse-ide'),
    url: z.string(),
    ideName: z.string(),
    ideRunningInWindows: z.boolean().optional(),
  }),
)
```

专门用于 VS Code、JetBrains 等 IDE 扩展提供的 MCP 服务器。额外的 `ideName` 字段用于在日志和 UI 里显示正确的 IDE 名称，`ideRunningInWindows` 处理 Windows 路径的特殊情况。

这是 `sse` 的特化版本，不是全新协议——只是加了 IDE 环境相关的元数据。

**http（Streamable HTTP）**

```typescript
export const McpHTTPServerConfigSchema = lazySchema(() =>
  z.object({
    type: z.literal('http'),
    url: z.string(),
    headers: z.record(z.string(), z.string()).optional(),
    headersHelper: z.string().optional(),
    oauth: McpOAuthConfigSchema().optional(),
  }),
)
```

MCP 最新规范引入的 Streamable HTTP transport，支持双向流（不只是 SSE 的单向推送）。签名和 `sse` 几乎一样，但底层实现支持 HTTP/2 的 multiplexing，更适合高并发场景。

**ws（WebSocket）**

```typescript
export const McpWebSocketServerConfigSchema = lazySchema(() =>
  z.object({
    type: z.literal('ws'),
    url: z.string(),
    headers: z.record(z.string(), z.string()).optional(),
    headersHelper: z.string().optional(),
  }),
)
```

WebSocket 全双工通信。适合需要频繁双向消息交换的场景（如实时协作、频繁的状态更新）。注意 ws 没有 oauth 字段——WebSocket 认证通常通过连接时的 headers 完成。

**sdk（进程内通信）**

```typescript
export const McpSdkServerConfigSchema = lazySchema(() =>
  z.object({
    type: z.literal('sdk'),
    name: z.string(),
  }),
)
```

这是最特殊的 transport。SDK 嵌入式 MCP 服务器运行在同一个进程内，通过内存消息队列通信，不需要网络或子进程。`SdkControlClientTransport`（本卷前面分析过）就是这种 transport 的实现。

适合：把 MCP 服务器打包进 Claude Code 本身，提供内置能力（如 computer use、Claude in Chrome）。

---

## transport 选择逻辑

`client.ts` 里根据 config 类型选择对应 transport：

```typescript
// 简化示意
function createTransport(config: McpServerConfig): Transport {
  switch (config.type) {
    case 'stdio':
      return new StdioClientTransport({ command: config.command, args: config.args })
    case 'sse':
      return new SSEClientTransport(new URL(config.url), { headers: config.headers })
    case 'http':
      return new StreamableHTTPClientTransport(new URL(config.url), ...)
    case 'ws':
      return new WebSocketTransport(config.url, ...)
    case 'sdk':
      return new SdkControlClientTransport(config.name, sendMcpMessage)
    // ...
  }
}
```

这是策略模式：transport 接口统一（`start/send/close`），实现各异，上层状态机不感知具体 transport 类型。

---

## 关闭时的完整性

无论哪种 transport，关闭时都必须处理 in-flight 调用：

```typescript
// client.ts 的关闭逻辑（简化）
async function closeConnection(serverName: string) {
  const inflight = getInflightCalls(serverName)
  for (const call of inflight) {
    call.abort()  // 通知等待方：连接已关闭
  }
  await transport.close()
}
```

只关 transport 不 abort 挂起调用，会导致 Promise 永远等待。这是任何实现了持久连接的客户端都必须处理的问题。

---

## 面试指导

**"设计一个支持多种通信协议的客户端，如何保持代码简洁？"**

核心设计原则：

1. **统一 transport 接口**：`{ start(), send(message), close() }`，所有实现遵循相同接口
2. **状态机与 transport 解耦**：连接状态管理、重试逻辑、能力缓存放在上层，不依赖具体 transport
3. **工厂模式创建 transport**：根据配置类型创建对应实现，调用方不感知
4. **关闭时的完整性**：任何持久连接的关闭都必须处理 in-flight 请求，这是最容易被遗漏的地方

提到"transport 多样性不是'六种方式做同一件事'，而是对六种不同约束的适配"——这说明你理解了协议选型的本质。
