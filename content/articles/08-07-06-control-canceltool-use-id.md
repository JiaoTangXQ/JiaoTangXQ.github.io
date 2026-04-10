---
title: "故障恢复推演：远端 Agent 断线后，未完成的权限请求去哪了？"
slug: "08-07-06-control-canceltool-use-id"
date: 2026-04-09
topics: [远端与边界]
summary: "control_cancel_request 带着 tool_use_id 到来，本地从 pendingPermissionRequests Map 里精确定位并移除对应审批项——这不是细节，而是「并发权限请求可能同时存在」这个设计前提的必然推论。"
importance: 1
---

# 故障恢复推演：远端 Agent 断线后，未完成的权限请求去哪了？

## 场景设定

假设这样一个场景：

1. 远端 Agent 正在并发执行多个工具
2. 工具 A 请求权限 → 本地显示审批弹窗 A
3. 工具 B 请求权限 → 本地显示审批弹窗 B
4. 用户还没来得及批准任何一个
5. 远端 Agent 因为某种原因需要撤销工具 A 的权限请求

问题：怎么精确取消审批弹窗 A，而不影响弹窗 B？

## 简单方案的局限

最简单的取消实现：

```
收到取消信号 → 清空所有 pending 的审批请求
```

这在"同时只有一个审批请求"的前提下是正确的。但并发工具调用是 Claude Code 的设计能力——Agent 可以同时发起多个独立的工具操作，多个工具同时请求权限。

如果取消信号只是"取消当前审批"（没有精确标识），本地就无法区分"取消 A 但保留 B"和"取消所有"。结果要么取消了不该取消的，要么实现了一个假设前提（单请求）而在实际使用中出问题。

## control_cancel_request 的精确定位

取消请求携带 `request_id`，本地处理逻辑：

```typescript
// RemoteSessionManager
handleControlCancelRequest(cancelRequest) {
  const requestId = cancelRequest.request_id
  
  // 从 pendingPermissionRequests Map 里精确找到这条请求
  const pendingRequest = this.pendingPermissionRequests.get(requestId)
  if (!pendingRequest) {
    // 可能已经被处理了，或者是重复取消
    return
  }
  
  // 从 Map 里移除
  this.pendingPermissionRequests.delete(requestId)
  
  // 通知 UI 精确移除对应的审批项，附带 tool_use_id 供 UI 精确匹配
  this.onPermissionCancelled(requestId, pendingRequest.tool_use_id)
}
```

`tool_use_id` 和 `request_id` 是两个不同的标识：

- `request_id`：这次权限问询的唯一 ID（`control_request` 里的字段）
- `tool_use_id`：发起这次工具调用的 tool use 块的 ID（`AssistantMessage.content[0].id`）

为什么需要两个 ID？因为 UI 里的审批项是用 `tool_use_id` 来渲染和标识的（它对应的是 `AssistantMessage` 里的 `tool_use` 块），而取消信号用的是 `request_id`。

本地需要通过 `pendingPermissionRequests` 这个 Map，把 `request_id` 映射到对应的 `tool_use_id`，才能通知 UI 精确移除正确的审批项。

## 断线时的批量清理

上面的单个取消是"正常情况"。断线时呢？

```typescript
// 断线时的清理
clearAllPendingPermissions() {
  for (const [requestId, request] of this.pendingPermissionRequests) {
    this.onPermissionCancelled(requestId, request.tool_use_id)
  }
  this.pendingPermissionRequests.clear()
}
```

断线时，没有服务端发来单独的取消信号——服务端本身也断了。本地需要主动遍历所有 pending 请求，逐一发出取消通知，让 UI 关闭所有打开的审批弹窗。

这和单个取消使用相同的 `onPermissionCancelled` 接口，UI 层不需要区分"服务端主动取消"和"断线引发的批量取消"——两者对 UI 来说结果相同：关闭对应的审批弹窗。

## 悬挂请求（Dangling Request）的危险

如果不正确清理 pending 请求，会发生什么：

**场景 A：断线后 UI 不清理**

用户在 claude.ai 看到一个审批弹窗，会话已经断了，弹窗还在。用户批准了。本地发出 `control_response`，发到哪里？没有活跃的 WebSocket，HTTP POST 失败。弹窗不消失，用户困惑。

**场景 B：重连后不清理旧 Map**

旧会话断线，重连建立了新会话。如果 `pendingPermissionRequests` 没有清空，旧的 `request_id` 还在 Map 里。新会话里恰好来了一个新的 `control_cancel_request`，`request_id` 和旧的碰巧一样（虽然不太可能，但设计上不能依赖这一点）——逻辑混乱。

正确的设计：**Map 的生命周期严格绑定到会话的生命周期**。会话建立时清空，会话结束（断线/关闭）时清空。

## 面试指导

"如何处理分布式系统中的悬挂状态（dangling state）"是系统设计面试的进阶考点。

关键点：

1. **识别悬挂条件**：什么情况下会产生"发出了请求但没有对应的清理"？对于权限请求，是断线和超时
2. **清理触发点**：除了正常完成，还需要在哪些路径触发清理？（断线、超时、进程退出）
3. **清理的精确性**：单个清理用精确标识（`tool_use_id`），批量清理遍历整个 Map
4. **状态生命周期绑定**：Map 的生命周期要和外层 session 的生命周期显式绑定，不能让旧状态在新会话里污染

"悬挂状态"是分布式系统里资源泄漏的主要来源之一。能在设计阶段识别出悬挂条件并提供清理机制，是成熟系统设计的标志。
