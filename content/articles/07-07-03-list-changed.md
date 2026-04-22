---
title: "list_changed 通知驱动失效：为什么不用轮询，不用全量重置？"
slug: "07-07-03-list-changed"
date: 2026-04-09
topics: [扩展系统]
importance: 1
---

# list_changed 通知驱动失效：为什么不用轮询，不用全量重置？

## 缓存策略分析：MCP 能力缓存面对的三种失效场景

**场景 A：服务器热部署了新工具**

客户端没有感知，用的还是旧工具列表。用户找不到新工具，或者调用了已删除的工具，得到神秘错误。

**场景 B：用户完成 OAuth 认证，解锁了受保护工具**

认证前工具列表有 5 个，认证后有 8 个。如果缓存不失效，用户完成认证后还是只看到 5 个工具。

**场景 C：管理员修改了资源权限，某些资源消失了**

prompt 模板依赖这些资源。如果资源缓存不失效，prompt 里引用的资源可能是虚假的——展示给用户，但实际已经不可访问。

这三个场景覆盖了 MCP 世界里的主要变化类型，也是 `list_changed` 通知被设计成精准失效的原因。

---

## 通知驱动 vs 轮询

**轮询方案的问题：**

```
客户端每 30 秒轮询一次工具列表：
- 工具刚更新 → 用户最多等 30 秒
- 30 秒内服务器没变 → 浪费一次网络请求
- 工具和资源要分别轮询 → 两倍请求数
```

**通知驱动的优势：**

```
服务器工具更新 → 立即推送 tools/list_changed
客户端收到 → 立即重拉工具列表
用户感知到新工具的延迟 ≈ 网络 RTT（通常 < 100ms）
```

但通知驱动也有代价：需要持久连接，断线时可能错过通知。这是为什么 session 过期重连后，`client.ts` 会重新拉取所有列表——重连期间可能错过了多个 `list_changed`。

---

## list_changed 的三种类型

MCP 协议定义了三种列表变化通知：

- `tools/list_changed`：工具列表变化
- `resources/list_changed`：资源列表变化
- `prompts/list_changed`：prompt 列表变化

`client.ts` 注册了对应的通知 handler，收到通知后只重拉对应类型的列表：

```typescript
// 简化示意：
client.setNotificationHandler('tools/list_changed', async () => {
  const tools = await client.listTools()
  updateToolsCache(serverName, tools)
})

client.setNotificationHandler('resources/list_changed', async () => {
  const resources = await client.listResources()
  updateResourcesCache(serverName, resources)
  // 注意：资源变化还要连带失效依赖这些资源的 prompt 缓存
  invalidatePromptCache(serverName)
})
```

这种精准失效意味着：工具变化不影响资源缓存，资源变化不影响工具缓存（但会影响 prompt 缓存，因为 prompt 可能引用了那些资源）。

---

## 为什么资源变化要连带失效 prompt？

这是一个有趣的依赖关系分析：

```
resources ←─── prompts
           ↑
    tool implementations
```

- `prompt` 模板可能引用具体资源（"使用资源 X 作为上下文"）
- 资源消失后，prompt 里的引用变成空指针
- 如果 prompt 缓存不失效，模型拿到的 prompt 里有不存在的资源引用

所以 `resources/list_changed` 不只失效资源缓存，还要失效 prompt 缓存。这是"依赖图感知的缓存失效"——理解对象之间的依赖关系，才能正确传播失效。

---

## 与前端 React 的对比

这个模式和 React 的状态管理有相似之处：

- `list_changed` 通知 ≈ Redux action 或 Zustand state update
- 重拉列表 ≈ useEffect 里的数据获取
- 依赖图感知失效 ≈ React 的依赖数组（`useMemo([dep1, dep2])`）

区别是：React 的状态管理发生在客户端内部，而 MCP 的状态同步发生在客户端和服务端之间，还有网络延迟和断线的问题。

---

## 失效策略的权衡矩阵

| 策略 | 延迟 | 开销 | 实现复杂度 | 适用场景 |
|---|---|---|---|---|
| 永不失效 | 最低 | 无 | 最低 | 静态配置 |
| 定时轮询 | 中（轮询间隔） | 中 | 低 | 对延迟不敏感 |
| 全量重置 | 低 | 高 | 低 | 状态变化频繁且剧烈 |
| 通知驱动精准失效 | 最低 | 最低 | 高 | 需要低延迟且服务端支持推送 |

Claude Code 选择了实现复杂度最高、但延迟和开销最低的方案。这是因为 MCP 服务器的能力变化不频繁，但每次变化的用户可感知度很高（用户直接在工具列表里看到）。

---

## 面试指导

**"如何设计一个缓存失效策略？"**

标准回答："LRU + TTL"。这适合大多数场景，但不适合"需要立即感知外部变化"的场景。

更深入的回答：

1. **主动失效 vs 被动失效**：TTL 是被动的（等时间到了再失效），通知是主动的（外部变化立即触发）
2. **全量失效 vs 精准失效**：全量失效实现简单但开销大；精准失效需要理解依赖关系
3. **依赖图追踪**：当 A 的变化可能使 B 过期时，失效系统需要知道 A → B 的依赖关系

说出"精准失效需要先建模对象之间的依赖关系，否则容易欠失效（用了过期数据）或过失效（频繁不必要的重拉）"——这是缓存系统设计的核心权衡。
