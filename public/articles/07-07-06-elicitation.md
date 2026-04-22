---
title: "elicitation 的初始化窗口兜底：为什么先返回 cancel 而不是等 UI 就位？"
slug: "07-07-06-elicitation"
date: 2026-04-09
topics: [扩展系统]
importance: 1
---

# elicitation 的初始化窗口兜底：为什么先返回 cancel 而不是等 UI 就位？

## MCP elicitation 是什么？

Elicitation 是 MCP 协议里的一个机制：MCP 服务器在工具执行过程中，需要向用户获取额外信息（如确认操作、填写表单、完成 OAuth 授权），就发送一个 `elicitation/create` 请求。

客户端收到这个请求后，展示对应的 UI，等待用户响应，然后把用户的回答返回给服务器。

这是一个同步等待的请求-响应模式：服务器发出请求后会阻塞，等待客户端的回答才能继续。

---

## 初始化窗口的问题

Claude Code 的 UI 组件是异步初始化的。MCP 服务器的连接和工具列表发现可能在 UI 完全就位之前就发生。

如果一个 MCP 服务器在连接初始化阶段（UI 还没完全启动）就发送了 elicitation 请求：

**没有 handler 时：**
SDK 可能抛出"没有 handler 注册"的错误，或者 elicitation 请求永远没有响应。
服务器在等待客户端回答，客户端完全没有响应。
服务器可能超时失败，或者整个连接被挂起。

**等 UI 就位后再注册 handler：**
也许有人说"就等 UI 就位再建立连接"。但 MCP 连接的时机不完全由 Claude Code 控制，某些情况下服务器可能主动发起 elicitation。

---

## 临时 handler 的实现

```typescript
// 简化示意：初始化阶段的临时 handler
client.setRequestHandler(ElicitRequestSchema, async () => {
  return { action: 'cancel' }
})
```

这个 handler 做的事情很简单：不管什么 elicitation 请求，直接返回 `cancel`（取消）。

`cancel` 是 MCP elicitation 协议里定义的三种响应之一（`accept`、`decline`、`cancel`）。`cancel` 的语义是"用户取消了这次操作"，服务器应该优雅地处理这个情况（通常是停止等待，以某种方式继续或中止当前工具执行）。

---

## 正式 handler 的接管

等 UI 初始化完成后，`registerElicitationHandler` 被调用，用完整的交互逻辑替换掉临时 handler：

```typescript
export function registerElicitationHandler(
  client: Client,
  serverName: string,
  setAppState: (f: (prevState: AppState) => AppState) => void,
): void {
  try {
    client.setRequestHandler(ElicitRequestSchema, async (request, extra) => {
      // 1. 先运行 elicitation hooks（程序化处理）
      const hookResponse = await runElicitationHooks(
        serverName,
        request.params,
        extra.signal,
      )
      if (hookResponse) return hookResponse

      // 2. 把 elicitation 推入 AppState.elicitation.queue
      // 3. UI 订阅 queue，展示对应的表单或 URL 跳转界面
      // 4. 用户完成操作，resolve Promise
      // 5. 运行 elicitation result hooks
      // 6. 返回用户的回答给服务器
      const response = new Promise<ElicitResult>(resolve => {
        setAppState(prev => ({
          ...prev,
          elicitation: {
            queue: [
              ...prev.elicitation.queue,
              {
                serverName,
                requestId: extra.requestId,
                params: request.params,
                respond: (result: ElicitResult) => resolve(result),
                // ...
              },
            ],
          },
        }))
      })
      // 等待用户响应
      const rawResult = await response
      return await runElicitationResultHooks(serverName, rawResult, extra.signal)
    })
  } catch {
    // 客户端没有声明 elicitation capability，跳过
    return
  }
}
```

正式 handler 的完整流程：

1. 运行 hooks（允许程序化拦截 elicitation）
2. 把请求推入 AppState 的 elicitation 队列
3. React 组件订阅这个队列，渲染对应 UI
4. 用户操作完成，Promise 解析
5. 运行 result hooks（允许程序化修改用户响应）
6. 返回最终结果给 MCP 服务器

---

## hooks 拦截：程序化 elicitation

`runElicitationHooks` 允许系统在展示 UI 之前，用程序化方式处理 elicitation：

```typescript
const hookResponse = await runElicitationHooks(serverName, request.params, extra.signal)
if (hookResponse) {
  // 程序化处理，不展示 UI
  return hookResponse
}
```

适用场景：
- 自动化测试中，不想每次都弹出 UI 等待用户点击
- 企业策略中，某些类型的 elicitation 自动 decline
- CI/CD 环境中，所有 elicitation 自动 cancel

这是"先钩子后 UI"的设计模式：给程序逻辑优先权，UI 是最后的 fallback。

---

## 兜底设计的一般原则

临时 handler 这个设计揭示了一个更广泛的工程原则：

**在异步初始化完成之前，系统对外提供的服务应该是"安全降级"的，而不是"未定义行为"的。**

"没有 handler"是未定义行为：服务器请求可能挂死、超时或导致连接断开。
"返回 cancel 的临时 handler"是安全降级：服务器收到了明确的响应，可以优雅处理。

安全降级比"等一切就绪再提供服务"更可靠，因为"一切就绪"的时机是不确定的。

---

## 面试指导

**"如何处理系统初始化期间到来的外部请求？"**

三种策略：

1. **队列化**：把请求存起来，等系统就绪后重新处理
2. **拒绝**：明确返回"服务暂不可用"（HTTP 503）
3. **兜底响应**：返回一个安全的默认响应（本文的 cancel 方案）

哪种更好取决于具体场景：
- 如果请求可以重放（幂等），队列化是好选择
- 如果客户端可以重试，拒绝是简洁的选择
- 如果请求不可重放且客户端需要明确响应（如 elicitation），兜底响应是最安全的

elicitation 的特殊性在于它是同步阻塞的——服务器在等响应，不能被长时间挂起。所以"立即返回 cancel"比"等到 UI 就位再处理"更合适。
