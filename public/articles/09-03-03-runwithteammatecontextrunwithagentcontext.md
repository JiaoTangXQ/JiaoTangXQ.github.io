---
title: "runWithTeammateContext 套 runWithAgentContext：为什么需要两层 AsyncLocalStorage？"
slug: "09-03-03-runwithteammatecontextrunwithagentcontext"
date: 2026-04-09
topics: [多Agent协作]
summary: "Claude Code 给同进程 teammate 套了两层 AsyncLocalStorage 上下文：外层 TeammateContext 管团队身份，内层 AgentContext 管执行归因。两层不是冗余，而是分开回答'你在哪个团队'和'这次执行是谁发起的'两个不同问题。这篇从原理到取舍，解释双层上下文的设计理由。"
importance: 1
---

# runWithTeammateContext 套 runWithAgentContext：为什么需要两层 AsyncLocalStorage？

Claude Code 里，in-process teammate 的执行循环是这样套的：

```
runWithTeammateContext(teammateContext, () => {
  ...
  runWithAgentContext(agentContext, () => {
    runAgent(...)
  })
  ...
})
```

两层嵌套，两个不同的 AsyncLocalStorage。

看到这里，一个自然的问题是：为什么不合并成一个？把团队身份和执行归因全放进同一个 store，读的时候一起读，岂不是更简单？

## 两层在回答不同问题

**TeammateContext（外层）** 回答："我是团队里的哪个成员？"

```typescript
type TeammateContext = {
  agentId: string          // "researcher@my-team"
  agentName: string        // "researcher"
  teamName: string         // "my-team"
  color?: string           // "blue"
  planModeRequired: boolean
  parentSessionId: string  // leader 的 session UUID
  isInProcess: true
  abortController: AbortController
}
```

这些信息是相对稳定的——在 researcher 的整个生命周期里，它的 agentName、teamName、color 不会变。它们用于：消息路由（把权限请求发给 leader）、UI 显示（worker badge 上显示颜色和名字）、日志归属（这条日志是 researcher 产生的）。

**AgentContext（内层）** 回答："这次特定的执行是以什么身份发起的？"

AgentContext 包含的是执行级别的元数据：分析标识符、调用追踪 ID、这次 runAgent 调用的具体参数。这些信息是**瞬时的**——每次 runAgent 调用可能有不同的 AgentContext，记录的是"这次 API 调用属于哪个 agent 类型、要记到哪个分析维度"。

两者的区别在于**生命周期**：TeammateContext 是 teammate 级别的，伴随整个 teammate 存活；AgentContext 是单次 runAgent 调用级别的，可能在一个 teammate 的生命周期里被创建多次。

## 合并会有什么问题

假设把两层合并：

```typescript
type UnifiedContext = TeammateContext & AgentContext
```

问题一：**类型混乱**。团队身份字段（`teamName`、`color`）和执行追踪字段（分析 ID、调用 ID）混在同一个类型里，读这个类型定义的人很难分清哪些字段是"这次调用的"，哪些是"这个成员的"。

问题二：**更新粒度不匹配**。TeammateContext 在 teammate 创建时设定，之后几乎不变。AgentContext 每次 runAgent 都可能需要创建新的（因为要有新的追踪 ID）。如果合并成一个 store，"每次创建新 AgentContext"就会触发整个 context 的重建，连 TeammateContext 部分也要重新设置——即使那些字段没变。

问题三：**读取代码的可读性**。`getTeammateContext()` 返回的是一个意图清晰的类型，调用方知道"我要团队身份信息"；`getAgentContext()` 返回的是执行追踪信息。如果合并成一个，调用方需要从一大堆字段里找自己要的那部分，上下文意图不清晰。

## 优先级和回退逻辑

`teammate.ts` 里的函数展示了这两种机制如何协作：

```typescript
export function getAgentName(): string | undefined {
  // 优先级 1：AsyncLocalStorage（in-process teammates）
  const inProcessCtx = getTeammateContext()
  if (inProcessCtx) return inProcessCtx.agentName

  // 优先级 2：dynamicTeamContext（tmux teammates via CLI args）
  return dynamicTeamContext?.agentName
}
```

同样的优先级逻辑贯穿所有 `getAgentXxx()` 函数。AsyncLocalStorage 是最高优先级，因为 in-process teammate 是最"精确"的身份来源。

这个设计允许同一套代码同时服务三种场景：
- In-process teammate（AsyncLocalStorage）
- Tmux teammate（dynamicTeamContext）
- 普通非团队 agent（env vars）

调用方不需要判断"我现在是哪种 teammate"，只需要调用 `getAgentName()`，系统自动按优先级返回正确的值。

## 两层 vs 语言内置方案的对比

Java 里有 `ThreadLocal`，相当于按线程隔离的全局变量。如果 Java 版的 Claude Code 用 ThreadLocal 实现同样的隔离，会是：

```java
ThreadLocal<TeammateContext> teammateContextStorage = new ThreadLocal<>();
ThreadLocal<AgentContext> agentContextStorage = new ThreadLocal<>();
```

原理相同，但 Node.js 的 `AsyncLocalStorage` 比 `ThreadLocal` 更适合异步代码——它追踪的不是线程，而是 async 调用链，即使用了 `Promise.all`、`setTimeout` 等异步操作，上下文也能正确传播。

这是两种语言在并发模型上的根本差异：Java 用线程，Node.js 用 event loop + 异步调用链。两种语言的"局部存储"机制因此有不同的传播语义。

## 面试怎么答

如果面试题是"为什么要用两层上下文而不是一层"：

**直接答案**：两层回答了不同生命周期的问题。一层是身份（整个 agent 生命周期稳定），一层是执行（每次调用可能不同）。合并成一层会混淆这两种语义，增加维护成本。

**类比**：这类似于 HTTP 请求处理里的"session 上下文"和"request 上下文"。Session 是用户级别的，跨多个请求；Request 是单次 HTTP 请求级别的。你不会把这两种上下文合并成一个，因为它们的生命周期不同，更新频率不同。

**工程实践**：当你看到代码里有多层 AsyncLocalStorage 或 ThreadLocal，不要急着"简化"成一层。先问：这几层在回答不同的问题吗？它们的生命周期匹配吗？如果是，多层是正确的，不是过度设计。
