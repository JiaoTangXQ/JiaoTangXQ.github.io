---
title: "serverName、socket 路径和 MCP 名字为什么要保持一致"
slug: "12-07-04-servernamesocket"
date: 2026-04-09
topics: [外延执行]
summary: "createChromeContext() 固定 serverName 为「Claude in Chrome」，common.ts 统一了 CLAUDE_IN_CHROME_MCP_SERVER_NAME 和 socket 路径构造。显示名、MCP 协议名和连接地址三者一致，是让 reconnect、日志和 UI 能互相认出来的基础。"
importance: 1
---

# serverName、socket 路径和 MCP 名字为什么要保持一致

`createChromeContext()` 里：

```typescript
const serverName = 'Claude in Chrome';
```

`common.ts` 里：

```typescript
const CLAUDE_IN_CHROME_MCP_SERVER_NAME = 'Claude in Chrome';
const SOCKET_DIR_BASE = 'claude-in-chrome';
// 路径：~/.local/share/claude-in-chrome/<username>/<pid>.sock
```

三个地方：显示名、MCP 协议注册名、socket 路径前缀，全部指向同一个字符串。

## 为什么这三个要一致

**reconnect 依赖名字**：当连接断开后，系统需要找回同一个服务重连。找的依据是名字。如果 MCP 注册的名字是 `claude-chrome-bridge`，但 reconnect 逻辑在找 `Claude in Chrome`，就找不到，连接无法恢复。

**日志和 UI 依赖名字**：用户在日志里看到 `[Claude in Chrome]`，在 UI 里看到的是同一个名字——这是他们判断「哦，这是那个功能」的依据。如果日志里是一个技术名字，UI 里是另一个产品名字，用户需要自己做映射。

**socket 路径和名字绑定**：当需要扫描所有活跃的 `Claude in Chrome` socket 时（比如发现可以连接的已有实例），路径前缀 `claude-in-chrome` 就是搜索依据。如果路径和名字对不上，这个发现机制就失效了。

## 命名一致性是连接可靠性的基础

这三个「名字」看起来像纯粹的字符串，是不起眼的配置细节。但它们实际上是不同系统层之间的「握手暗号」：你说的这个功能，和我说的这个功能，是同一个吗？

名字不一致，握手就失败，系统各部分开始各说各话。保持一致，是让一个跨越多个层次（UI、协议、文件系统）的功能能被整体认识和操作的前提。
