---
title: "void 调用、失败只记日志：礼节性通知为什么不能阻塞主路？"
slug: "07-07-07-ide-connected"
date: 2026-04-09
topics: [扩展系统]
summary: "client.ts 连上 MCP server 后顺手 void 调用 maybeNotifyIDEConnected，失败只记日志。这个设计决策体现了区分'主路径操作'和'礼节性附带操作'的工程判断。"
importance: 1
---

# void 调用、失败只记日志：礼节性通知为什么不能阻塞主路？

## 代码现象

```typescript
// 连接 MCP 服务器后：
await connectToServer(config)
void maybeNotifyIDEConnected(client)  // void：不等待结果，失败不影响后续
```

两个关键信号：
1. `void`：调用结果被丢弃，不 `await`
2. 内部实现：失败时只调用 `logMCPDebug`，不抛出错误

---

## `ide_connected` 通知是什么？

当 Claude Code 通过 MCP 连上一个服务器时，可以向 IDE 插件（VS Code、JetBrains 等）发送一个通知，告诉 IDE"我现在连上了某个 MCP 服务器"。

IDE 收到这个通知后可以：
- 在状态栏显示"MCP: 已连接 my-server"
- 更新工具面板的可用工具列表
- 记录日志供调试使用

这是一个**礼节性通知**（courtesy notification）：IDE 多知道一点信息，可以提供更好的 UI 反馈，但这个通知的成败对 Claude Code 的核心功能没有影响。

---

## 如果改成 await 会怎样？

```typescript
// 假设改成 await
await maybeNotifyIDEConnected(client)  // ← 危险！
```

后果：

1. `maybeNotifyIDEConnected` 内部有网络通信（发消息给 IDE 扩展）
2. 如果 IDE 扩展没运行、响应慢或发生错误，整个连接过程被阻塞
3. 用户在命令行里等待，不知道是 MCP 服务器慢还是 IDE 通知卡住了
4. 如果 IDE 通知抛出未捕获的错误，可能导致整个 MCP 连接失败

把一个"可有可无的附加操作"放在主路径上，让它可以中断核心功能——这是典型的优先级倒置错误。

---

## void 的工程含义

在 TypeScript 里，`void` 通常是"我知道这个 Promise 可能 reject，但我选择不处理它"的信号。这有时被视为代码异味，但在某些场景下是正确的选择。

判断标准：
- 这个操作失败后，系统能继续正常工作吗？✓（是）→ 可以 void
- 这个操作的失败对用户有什么影响？→ IDE 少了一条状态更新，几乎无感知
- 这个操作的失败是否需要报告给用户？→ 不需要，记日志供开发者诊断即可

满足以上三条，`void` 是正确的。不满足（比如"保存文件"这种必须成功的操作），`void` 就是 bug。

---

## 与"fire and forget"模式的关系

`void maybeNotifyIDEConnected(client)` 是"fire and forget"（发出去不管）模式的实现。

这个模式在这些场景下是合理的：
- **分析/遥测数据上报**：数据丢一条不影响用户
- **日志写入**（异步）：日志丢失可以接受
- **UI 状态更新**（非关键）：如 IDE 通知
- **预缓存**：提前加载可能用到的数据，失败了就等真正需要时再加载

不应该 fire and forget：
- 写入持久化数据（数据库、文件）
- 支付、余额操作
- 权限变更
- 任何失败后用户会感知到的操作

---

## 另一个例子：IDE 通知 vs 工具调用

对比同一个 `client.ts` 里的两种调用：

```typescript
// 礼节性通知：void，失败不管
void maybeNotifyIDEConnected(client)

// 工具调用：await，失败影响整个对话
const result = await client.callTool({ name, input })
```

前者是附属功能，后者是核心功能。二者在代码里的处理方式体现了这个区别。

---

## 面试指导

**"如何区分'必须成功'的操作和'可以失败'的操作？"**

问自己这几个问题：

1. **失败后用户能感知到吗？** 能感知 → 必须处理失败
2. **失败后业务状态是否一致？** 可能不一致 → 必须处理失败（或用事务）
3. **这个操作是主流程的一部分还是附属操作？** 附属 → 可以降级
4. **操作失败是否需要通知调用方？** 需要 → 必须 await；不需要 → 可以 void

具体到代码实践：所有"必须成功"的操作都应该 await 并处理 reject；可以降级的操作可以 void + 内部 catch + 记日志。

在架构层面，区分这两类操作还影响错误预算的分配：核心路径要求 99.9%+ 的成功率，附属路径可以接受更高的错误率。
