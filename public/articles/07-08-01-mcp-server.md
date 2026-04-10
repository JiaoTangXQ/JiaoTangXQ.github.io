---
title: "一个 MCP server 接入时带来什么？工具、资源、prompts、skills 的收编逻辑"
slug: "07-08-01-mcp-server"
date: 2026-04-09
topics: [扩展系统]
summary: "MCP server 连接后，client.ts 不只建 MCPTool。它同时把资源列表、资源读取工具、prompts、MCP skills 一起纳入本地运行时。一个 server 代表的是一片能力簇，不是一个函数表。"
importance: 1
---

# 一个 MCP server 接入时带来什么？工具、资源、prompts、skills 的收编逻辑

## MCP 的四种能力类型

MCP 协议在设计上不只是"工具调用协议"。一个 MCP 服务器可以暴露四种类型的能力：

```
MCP Server
├── Tools        ← 模型可以调用的函数（callTool）
├── Resources    ← 模型/用户可以读取的数据（URI 寻址）
├── Prompts      ← 服务器提供的提示模板
└── Skills       ← Claude Code 扩展：服务器侧的 /slash-commands（MCP_SKILLS 特性）
```

大多数教程和工具只讲 Tools，因为它最直接——模型调用函数，拿到结果。但 Claude Code 的 `client.ts` 把四种能力都收编进来，因为它接入的是一个完整的能力世界，不是一个孤零零的 API。

---

## 工具：MCPTool 的包装层

每个 MCP 工具被包装成 `MCPTool`：

```typescript
import { MCPTool } from '../../tools/MCPTool/MCPTool.js'
```

`MCPTool` 不只是透传工具调用，它还处理：
- 工具调用进度通知（`MCPProgress`）
- 输出大小限制（`MAX_MCP_DESCRIPTION_LENGTH = 2048`）
- 二进制内容持久化（大图片/文件存到本地，只传路径给模型）
- 工具调用的 collapse 分类（`classifyMcpToolForCollapse`，影响 UI 展示）

---

## 资源：两个工具入口

资源没有直接的"调用"语义，但 Claude Code 通过两个工具把资源变成模型可以操作的能力：

```typescript
import { ListMcpResourcesTool } from '../../tools/ListMcpResourcesTool/ListMcpResourcesTool.js'
import { ReadMcpResourceTool } from '../../tools/ReadMcpResourceTool/ReadMcpResourceTool.js'
```

- **ListMcpResourcesTool**：列出服务器提供的所有资源（名称、URI、MIME 类型）
- **ReadMcpResourceTool**：通过 URI 读取具体资源内容

这个设计让模型可以"探索"服务器提供的资源，而不只是被动接受。模型可以先 list，看到有什么资源，再 read 需要的那一个。

---

## Prompts：服务器提供的工作流模板

```typescript
// 连接后拉取 prompts：
const promptsResult = await client.listPrompts()
```

Prompts 是服务器提供的提示词模板，通常绑定了具体的工作场景。比如一个 GitHub MCP 服务器可能提供：
- "Code Review" prompt：自动填充 PR 差异
- "Issue Triage" prompt：按照特定格式分析 issue

用户可以通过 slash command（`/code-review`）直接触发这些工作流，而不需要手写提示词。

Prompts 和本地技能（skills）的主要区别：
- Prompts 来自服务器（`listPrompts`），内容由服务器决定
- 技能由用户或插件在本地定义，内容由文件或代码决定

---

## MCP Skills：服务器侧的 slash commands

```typescript
const fetchMcpSkillsForClient = feature('MCP_SKILLS')
  ? (
      require('../../skills/mcpSkills.js') as typeof import('../../skills/mcpSkills.js')
    ).fetchMcpSkillsForClient
  : null
```

这是通过 feature flag（`MCP_SKILLS`）控制的扩展功能。当服务器声明了 skill 能力时，Claude Code 可以通过 `fetchMcpSkillsForClient` 获取服务器侧的 skill 定义，然后用 `createSkillCommand` 把它们翻译成本地 `Command` 对象。

MCP skills 的特殊之处：
- 来自远端服务器，但翻译成本地 Command 对象后，看起来和本地技能一样
- 但 `loadedFrom: 'mcp'`，所以在 `getPromptForCommand` 里会禁止 shell 执行（安全边界）

---

## 接入一个 server 的时序

```
1. transport 连接建立
2. 发送 initialize 请求，服务器返回 capabilities
3. 根据 capabilities 拉取各类列表：
   - capabilities.tools → listTools() → MCPTool[]
   - capabilities.resources → listResources() → ServerResource[]
   - capabilities.prompts → listPrompts() → Prompt[]
   - feature('MCP_SKILLS') && capabilities.skills → fetchMcpSkillsForClient() → Command[]
4. 注册 list_changed 通知 handler（对应各类列表）
5. 注册 elicitation handler（初始化窗口临时 handler）
6. 注册 ListRoots handler（服务器可以查询 Claude Code 管理的目录）
7. void maybeNotifyIDEConnected(client)
8. 更新 AppState：server.type = 'connected'
```

这 8 步中，步骤 3 是最重的——4 类列表可以并发拉取，但每类都需要一次网络请求。

---

## ConnectedMCPServer 的字段设计

```typescript
export type ConnectedMCPServer = {
  client: Client
  name: string
  type: 'connected'
  capabilities: ServerCapabilities    // 服务器声明的能力（有哪些类型）
  serverInfo?: { name: string; version: string }  // 服务器自报的名称和版本
  instructions?: string               // 服务器提供的使用说明（给模型看的）
  config: ScopedMcpServerConfig
  cleanup: () => Promise<void>        // 关闭连接的清理函数
}
```

`instructions` 字段很有意思：服务器可以提供一段"如何使用我"的文字，会被注入到模型的系统提示里。这让服务器可以引导模型更好地使用自己提供的工具。

---

## 面试指导

**"设计一个能力发现系统（capability discovery），让客户端知道服务端当前能提供什么"**

Claude Code 的 MCP 接入是这类系统的好案例：

1. **握手时声明能力类型**（capabilities 字段）：不是把所有内容都发过来，而是先说"我有工具、资源、prompts"
2. **按需拉取具体列表**：只有声明了某类能力，才发出对应的 list 请求
3. **动态更新**：通过通知机制，能力列表变化时客户端立即感知

这和微服务的服务发现（Service Discovery）很类似：先知道"有哪些服务"，再去具体调用。区别是 MCP 的能力是动态变化的，不是注册一次就固定的。
