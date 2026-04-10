---
title: "面试题：computerUse 为什么要打包成 MCP 能力簇而不是直接暴露工具函数？"
slug: "12-02-01-computeruse"
date: 2026-04-09
topics: [外延执行]
summary: "Claude Code 没有把桌面操作做成几个内置工具函数，而是用 setupComputerUseMCP() 把整套能力包装成动态 MCP server，再用统一前缀 mcp__computer-use__* 接进主系统。这个包装层不是多余的 ceremony，而是让后端 API、permission 系统和 UI 渲染都能认出「这是同一簇能力」的关键设计。"
importance: 1
---

# 面试题：computerUse 为什么要打包成 MCP 能力簇而不是直接暴露工具函数？

## 先问一个反直觉的问题

如果你要给 AI Agent 加上"控制桌面"的能力，最直接的实现是什么？

大多数工程师的直觉是：写几个工具函数，比如 `clickAt(x, y)`、`typeText(s)`、`takeScreenshot()`，直接注册到 Agent 的工具列表里。

Claude Code 没有这么做。它专门写了一个 `setupComputerUseMCP()` 函数，把这些能力包装成一个动态 MCP server，工具名全部强制加上 `mcp__computer-use__` 前缀。

为什么要绕这一圈？

## 工具名不只是展示文案

`setup.ts` 里有一段注释，直接解释了为什么不能用内置工具名：

```ts
/**
 * The MCP layer isn't ceremony: the API backend detects mcp__computer-use__*
 * tool names and emits a CU availability hint into the system prompt
 * (COMPUTER_USE_MCP_AVAILABILITY_HINT in the anthropic repo). Built-in tools
 * with different names wouldn't trigger it. Cowork uses the same names for the
 * same reason.
 */
```

这段话很关键：**后端 API 会扫描工具名称列表，检测是否包含 `mcp__computer-use__*` 前缀，如果有就向 system prompt 注入一段"computer use 可用"的提示（COMPUTER_USE_MCP_AVAILABILITY_HINT）**。

如果桌面工具名字不符合这个约定，后端就不会注入这段提示，模型就不知道自己有桌面能力，整个功能链路就断了。

这说明工具命名本质上是一个**跨系统协议**，而不是一个展示层决定。名字错了，多层系统同时失效。

## 工具名的三层作用

`mcp__computer-use__*` 这个前缀在 Claude Code 里同时服务三个角色：

**第一层：后端识别**。API backend 靠这个前缀决定是否注入 CU availability hint 到 system prompt。前缀不对，提示不注入，模型不知道自己能做桌面操作。

**第二层：权限判断**。`allowedTools` 列表里存的就是这些完整工具名。权限系统靠名字匹配决定哪些工具可以绕过逐步确认。

```ts
const allowedTools = buildComputerUseTools(
  CLI_CU_CAPABILITIES,
  getChicagoCoordinateMode(),
).map(t => buildMcpToolName(COMPUTER_USE_MCP_SERVER_NAME, t.name))
```

**第三层：UI 渲染**。`toolRendering.tsx` 用同一组工具名做终端界面的覆盖渲染。桌面操作在终端里显示什么样，也靠名字识别。

三层系统靠同一套名字对齐，改一个名字就要三层同时改——这正是"通关文牒"的意思。

## 能力簇 vs 零散工具的架构差异

把桌面能力包成一整套 MCP 能力簇，而不是零散工具函数，带来的不只是命名统一，还有能力边界的清晰化。

**零散工具的问题**：系统其他部分无法判断"当前是否在进行桌面操作会话"。`request_access`、`allowedApps`、`grantFlags` 这些会话级状态无处挂靠，只能变成全局变量。

**能力簇的好处**：`COMPUTER_USE_MCP_SERVER_NAME` 是一个稳定的身份标识，整簇能力有共同的 server name、共同的权限模式、共同的 session 生命周期。`wrapper.tsx` 可以按"当前是否在 computer use 会话"来管理 `allowedApps` 等状态。

```ts
// 能力簇有清晰的身份边界
const COMPUTER_USE_MCP_SERVER_NAME = 'computer-use'

// 工具名都在这个命名空间下
buildMcpToolName(COMPUTER_USE_MCP_SERVER_NAME, tool.name)
// → mcp__computer-use__screenshot
// → mcp__computer-use__click
// → mcp__computer-use__type
```

## in-process MCP：保外观，优内部

这里有一个有意思的双层设计。`setupComputerUseMCP()` 返回的配置表面上是标准 `stdio` MCP server：

```ts
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

但注释已经说明：`command/args are never spawned — client.ts intercepts by name and uses the in-process server`。

也就是说，外面看到的是标准 MCP 配置，里面实际走的是进程内分支。为什么要保留这层外观？

因为工具发现、权限系统、system prompt 注入都在消费这份配置。如果打破 MCP 外观，这些系统都得学一套新的接入方式。保持外观，对外兼容不变；走进程内路径，对内不付子进程的开销。这是"对外统一口音，对内优化成本"的典型做法。

## 面试考察点

这道题考察的核心判断是：**架构决策中，接口契约的价值是否大于实现自由度的价值？**

直接暴露工具函数，实现更简单，但破坏了多层系统依赖的命名约定。包装成 MCP 能力簇，代码更重，但让后端、权限系统、UI 渲染都能继续说同一种语言。

Claude Code 选了后者。这个选择背后的判断是：**当一个设计决定影响到三个以上独立子系统时，接口稳定性的价值高于局部实现的简洁性**。

这类判断在系统设计面试中非常高频，特别是涉及"新能力如何接入已有系统"这类题型。

