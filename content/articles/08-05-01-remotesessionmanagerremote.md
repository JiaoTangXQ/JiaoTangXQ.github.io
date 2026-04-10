---
title: "面试题：RemoteSessionManager 为什么同时管 WebSocket、HTTP 和权限映射？"
slug: "08-05-01-remotesessionmanagerremote"
date: 2026-04-09
topics: [远端与边界]
summary: "WebSocket 订阅、HTTP 发送、权限请求映射三件事不能拆开，因为它们共享同一个「会话活着」的前提——断线时需要同时清理订阅、取消 pending 的权限请求、重置发送队列，分开管理意味着这三者的生命周期会静默漂移。"
importance: 1
---

# 面试题：RemoteSessionManager 为什么同时管 WebSocket、HTTP 和权限映射？

## 职责看起来杂，但有内在联系

初次看 `RemoteSessionManager` 的接口，会觉得职责混乱：

- `connect()` / `disconnect()` — 这是连接管理
- `sendMessage()` — 这是消息发送
- `respondToPermissionRequest()` — 这是权限处理
- `getPermissionRequest()` — 这是状态查询

这四类操作，如果按照"高内聚低耦合"的原则来拆，应该放进不同的类才对。为什么放在一起？

## 会话生命周期的视角

关键在于：这四件事共享同一个前提——**会话必须活着**。

当 WebSocket 断线时：
- 消息发送队列需要暂停（不然发出去的消息找不到接收方）
- Pending 的权限请求需要取消（不然用户在已断线的会话里批准了权限，批准信号找不到地方送）
- 连接状态需要更新（让 UI 显示"重连中"）

这三件事需要在**同一时刻**发生，响应同一个触发条件（断线）。如果把它们拆到三个独立的类里：

- `ConnectionManager` 知道断线了
- `MessageSender` 不知道，还在尝试发送
- `PermissionHandler` 不知道，pending 请求还在等待响应

要让三者联动，需要额外的事件总线或 observer 模式，反而增加了复杂度。

## 权限请求映射的特殊性

`requestId → callback` 的映射是权限审批机制的核心。

远端会话发来一个权限请求（`control_request`）：

```
{
  type: "control_request",
  request_id: "req-abc123",
  request: { subtype: "permission_request", tool_name: "Write", ... }
}
```

本地需要：
1. 把 `request_id` 记下来
2. 弹出用户审批 UI
3. 等用户操作
4. 用 `request_id` 找到回调，发回响应

这个 `request_id → callback` 的 Map，生命周期和会话绑定——会话结束，所有 pending 请求必须清理（否则内存泄漏，并且已经没有地方接受响应了）。

把这个 Map 放在 `RemoteSessionManager` 里，断线时天然能在同一处统一清理，而不是让 `PermissionHandler` 去监听 `ConnectionManager` 的事件。

## `cancelRequest` 的存在理由

`BridgePermissionCallbacks` 里有一个容易被忽视的方法：

```typescript
/** Cancel a pending control_request so the web app can dismiss its prompt. */
cancelRequest(requestId: string): void
```

这是在会话断线时，主动通知 Web 端"之前那个权限审批弹窗可以关掉了"。

如果没有这个取消机制：用户在 claude.ai 网页上看到一个权限审批弹窗，会话底层其实已经断线了，但弹窗还在。用户批准或拒绝后，响应发回去找不到接受方。

这个设计说明 RemoteSessionManager 的职责不只是本地状态管理，还要**驱动 Web 端的 UI 状态**。

## 状态一致性的代价

把这些职责集中在一起，代价是类的"知道的事情太多"。

但这个批评需要在正确的框架下评价：如果分散管理会导致状态在断线时不一致，那么集中管理是**刻意选择的权衡**，而不是违反了某个架构原则。

判断标准：**这些状态的一致性是否需要共同保证？**

对于 WebSocket 连接状态、消息发送队列、权限请求映射，答案是肯定的——它们一致性的触发条件（连接建立/断开）是同一个。

## 和 Saga 模式的对比

这个设计有点像后端的 Saga 模式（分布式事务）——多个步骤需要原子地执行或回滚。

断线时的"回滚"需要清理所有和当前连接相关的状态，这就是一个 Saga：

1. WebSocket 断开 → 触发 Saga
2. 清理消息发送队列
3. 取消所有 pending 权限请求（并通知 Web 端关闭弹窗）
4. 更新连接状态
5. 开始重连

如果每一步由不同的模块负责，Saga 的协调逻辑要放在哪里？放在 `RemoteSessionManager` 里，是最自然的答案——它拥有 Saga 的所有参与者。

## 面试指导

"单一职责原则"是面试里经常被机械引用的原则。

更准确的表述是：**职责是由触发条件和一致性要求定义的，不是由操作类型定义的**。

当断线、发送消息、权限审批这三件事共享同一个生命周期边界（会话存活），它们就属于同一个职责范围——即使它们在技术上看起来很不一样。

这是 Domain-Driven Design 里"聚合根（Aggregate Root）"概念的工程表达：把需要保持一致性的状态聚合在一起，让一个对象来负责协调。
