---
title: "面试题：in-process MCP server 为什么要保持 stdio 外观？"
slug: "12-04-01-stdio-server"
date: 2026-04-09
topics: [外延执行]
importance: 1
---

# 面试题：in-process MCP server 为什么要保持 stdio 外观？

## 一个让人困惑的设计

读 `setupComputerUseMCP()` 的代码时，第一眼会产生困惑：

```ts
// command/args are never spawned — client.ts intercepts by name and
// uses the in-process server. The config just needs to exist with
// type 'stdio' to hit the right branch. Mirrors Chrome's setup.
const args = isInBundledMode()
  ? ['--computer-use-mcp']
  : [join(fileURLToPath(import.meta.url), '..', 'cli.js'), '--computer-use-mcp']

return {
  mcpConfig: {
    [COMPUTER_USE_MCP_SERVER_NAME]: {
      type: 'stdio',
      command: process.execPath,
      args,
      scope: 'dynamic',
    } as const,
  },
  allowedTools,
}
```

代码返回了一个完整的 stdio MCP 配置，有 `command`、有 `args`、看起来应该会 spawn 一个子进程。但注释明确说：**这些 command/args 永远不会被真正执行**。

这到底是怎么回事？为什么要费事写一个永远不会被执行的配置？

## 从 client.ts 的视角理解

理解这个设计，需要从消费方的视角来看：`client.ts` 在建立 MCP 连接时，会先检查 server name，如果匹配到已知的 in-process server（比如 `computer-use`），就直接在进程内建立连接，完全绕过 `command/args`。

这个分支逻辑大致是：

```ts
if (isInProcessServer(serverConfig.name)) {
  // 走进程内路径，不 spawn 子进程
  return createInProcessMcpClient(serverConfig.name)
} else {
  // 正常 spawn 子进程
  return spawnSubprocessMcpClient(serverConfig.command, serverConfig.args)
}
```

这意味着：`type: 'stdio'` 的配置存在，但不是用来 spawn 进程的，而是用来**触发 MCP 客户端的正确分支**。配置里的 `command` 和 `args` 只是填充，确保配置结构完整，但实际执行时会被 short-circuit。

## 为什么不直接改成 in-process 类型？

如果有这么一种做法：
```ts
return {
  mcpConfig: {
    [COMPUTER_USE_MCP_SERVER_NAME]: {
      type: 'in-process',  // 假设存在这种类型
      serverFactory: createComputerUseMcpServer,
    },
  },
}
```

这样更诚实，不会让人误以为会 spawn 进程。但 Claude Code 没有这么做，原因是：

**工具发现依赖 MCP 配置格式**。系统里有很多地方会遍历 MCP 配置，检查 `type: 'stdio'` 来决定如何注册、如何展示。如果引入新类型，这些地方都需要适配。

**权限系统依赖标准配置字段**。`scope: 'dynamic'` 这个字段告诉权限系统这个 server 是动态加入的，需要特殊处理。标准字段，标准处理路径。

**system prompt 注入依赖配置存在**。后端 API 通过工具名列表判断是否注入 CU hint，这个列表从 MCP 配置里生成。只有配置存在，工具名才会出现在列表里。

保持 `type: 'stdio'` 外观，所有这些消费方都不需要改代码。换成 `type: 'in-process'`，需要一轮协调改动。

## 「外观稳定，实现可变」的设计模式

这是一个经典的软件设计模式实例：**让外部接口保持稳定，内部实现根据效率需求自由优化**。

类比场景：
- HTTP API 永远保持相同的 endpoint，内部实现从同步改成异步，从单机改成集群，外部调用方感知不到
- 数据库驱动提供标准 JDBC/ODBC 接口，内部可以是各种数据库引擎
- 操作系统提供 POSIX 标准，内部可以是各种 Unix 实现

Claude Code 的 in-process MCP 是同样的逻辑：外部接口是标准 stdio MCP 配置，内部实现是进程内绑定，效率更高，不付子进程开销。

## 进程内路径的性能优势

为什么要走进程内路径？因为桌面操作的工具调用非常频繁，而且往往是连续的序列。

每次工具调用如果需要：
1. 发 JSON-RPC 请求到子进程 stdin
2. 子进程处理
3. 通过 stdout 返回 JSON-RPC 响应
4. 主进程解析响应

这个 IPC 开销在每次点击或截图时都要付一遍。进程内调用则直接函数调用，延迟低两到三个数量级。

对于桌面自动化这种高频、连续操作的场景，这个差异会非常明显。

## 注释作为架构文档

注释 `command/args are never spawned — client.ts intercepts by name and uses the in-process server` 是一种架构文档的写法。

它在说：这段代码表面上的意思，不是它真实的运行时行为。如果没有这个注释，后来维护代码的人很可能会：
- 误以为 spawn 了子进程，花时间找子进程的日志
- 尝试修改 args 来影响子进程行为，发现完全没效果
- 觉得这是一段多余代码，尝试删除，然后发现工具发现和权限逻辑都断了

这类"表象和真相不一致"的代码，必须靠注释来保持清醒。这是成熟工程团队里一个重要的写代码习惯：**当代码的实际行为和它看起来应该做的事情不一致时，一定要留下解释**。

## 面试考察点

这道题考察的是对**接口稳定性与实现自由度之间的权衡**的理解，以及对**在大型系统里引入变更成本**的认识。

一个有深度的回答应该包括：
1. 为什么要保持 stdio 外观（消费方兼容性）
2. 实际走进程内路径有什么好处（延迟、资源开销）
3. 这种设计的维护成本是什么（代码不直观，需要注释解释）
4. 什么时候应该把这层"假外观"去掉（当消费方都迁移到支持 in-process 类型之后）

