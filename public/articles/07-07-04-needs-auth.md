---
title: "needs-auth 缓存：MCP 认证失败为什么要缓存 15 分钟？"
slug: "07-07-04-needs-auth"
date: 2026-04-09
topics: [扩展系统]
importance: 1
---

# needs-auth 缓存：MCP 认证失败为什么要缓存 15 分钟？

## 问题描述：没有缓存会发生什么？

场景：用户配置了一个需要 OAuth 的 MCP 服务器，但 token 过期了。

没有 needs-auth 缓存时：
1. Claude Code 启动，尝试连接服务器
2. 服务器拒绝（401），服务器状态变为 `needs-auth`
3. 用户重启 Claude Code（也许是无意中的）
4. Claude Code 再次尝试连接同一个服务器
5. 再次得到 401，再次弹出认证提示
6. 用户如果还没完成认证，循环继续

这在 UI 上的表现是：每次启动都出现认证失败提示，像是系统坏了，实际上只是 token 没刷新。

有了 needs-auth 缓存：
- 第一次认证失败后，服务器名写入缓存，TTL 15 分钟
- 15 分钟内重启，不再尝试连接，直接标记为 `needs-auth`
- 用户完成认证，token 刷新后，等 TTL 过期或手动清除缓存，下次启动正常连接

---

## 缓存文件的结构

`mcp-needs-auth-cache.json` 存储在 Claude Code 的配置目录里，格式大致是：

```json
{
  "my-github-mcp": {
    "timestamp": 1704067200000,
    "ttl": 900000
  },
  "my-linear-mcp": {
    "timestamp": 1704067800000,
    "ttl": 900000
  }
}
```

- 键是服务器名
- `timestamp` 是写入时间（Unix 毫秒时间戳）
- `ttl` 是存活时间（毫秒），900000 = 15 分钟

读取时检查 `timestamp + ttl > Date.now()`，过期的条目视为不存在。

---

## 为什么是 15 分钟？

15 分钟是一个工程直觉选择，权衡了两个方向的代价：

**太短（如 30 秒）：**
- 用户在会话内多次重试，还是会看到很多认证失败提示
- 对网络不稳定的场景（认证服务器临时不可达）没有太大帮助

**太长（如 24 小时）：**
- 用户修复了认证问题，却要等很久才能重新连接
- 或者必须手动清除缓存文件，用户体验更差

15 分钟对应一个"合理的处理时间"：用户一般能在 15 分钟内完成 OAuth 授权流程或者修复 token 问题。超过 15 分钟说明用户暂时不想处理（如去开了个会），返回后缓存也已过期，下次启动自动重试。

---

## 认证流程的完整状态机

`McpAuthError` 在工具调用层触发时，会把服务器状态推入 `needs-auth`：

```typescript
export class McpAuthError extends Error {
  serverName: string
  constructor(serverName: string, message: string) {
    super(message)
    this.name = 'McpAuthError'
    this.serverName = serverName
  }
}
```

处理链：

```
callTool()
  → 服务器返回 401
  → client.ts 抛出 McpAuthError
  → 上层捕获 McpAuthError
  → 写入 needs-auth 缓存
  → 更新 AppState：server.type = 'needs-auth'
  → UI 展示认证入口
```

这个分离很重要：`McpAuthError` 在工具调用层抛出，但 needs-auth 状态的管理和缓存写入发生在连接管理层。工具调用层不需要知道"认证失败后要怎么处理"，它只需要说"这次调用失败了，原因是认证问题"。

---

## needs-auth 和 failed 的区别

`MCPServerConnection` 里有两个相似的失败状态：

```typescript
export type FailedMCPServer = {
  name: string
  type: 'failed'
  config: ScopedMcpServerConfig
  error?: string
}

export type NeedsAuthMCPServer = {
  name: string
  type: 'needs-auth'
  config: ScopedMcpServerConfig
}
```

区别：
- `failed`：连接本身失败（服务器不存在、网络错误、配置错误），用户能做的事不多
- `needs-auth`：连接技术上可行，但需要用户主动完成一个认证动作

UI 行为也不同：
- `failed` 状态显示错误信息
- `needs-auth` 状态显示"点击这里完成认证"的可操作入口

这种区分让用户知道"这是我能解决的问题"还是"这是我需要等管理员修复的问题"。

---

## 面试指导

**"如何处理第三方服务认证失败？"**

几个关键设计决策：

1. **区分"认证失败"和"连接失败"**：两种失败的恢复策略完全不同，应该有独立的错误类型
2. **避免无限重试**：认证失败通常需要人工介入，无限重试只会制造噪音
3. **TTL 的选择**：缓存时间要覆盖"用户完成认证所需的合理时间"，太短没效果，太长影响用户体验
4. **状态可见性**：用户应该能看到"哪个服务需要认证"，而不是看到神秘的连接错误

补充：如果系统有多个需要认证的外部服务，考虑统一的"认证中心"界面，让用户在一个地方完成所有待认证服务的授权。Claude Code 的 `/mcp` 命令就提供了这种集中管理视图。
