---
title: "面试题：env-less 去掉了 Environment 层，省掉的是什么，失去的是什么？"
slug: "08-03-02-env-less"
date: 2026-04-09
topics: [远端与边界]
summary: "env-less（remoteBridgeCore.ts）用 POST /v1/code/sessions 直接换取 worker_jwt，绕过了 register/poll/ack/heartbeat 整套环境调度层——换来的是更低延迟和更简单的错误处理，代价是失去了租约保障和组织级容量管理。"
importance: 1
---

# 面试题：env-less 去掉了 Environment 层，省掉的是什么，失去的是什么？

## env-less 的核心思路

`remoteBridgeCore.ts` 文件头部的注释，把设计意图说得非常直白：

```
// Unlike initBridgeCore (env-based, ~2400 lines), this connects directly
// to the session-ingress layer without the Environments API work-dispatch layer:
//
//   1. POST /v1/code/sessions              → session.id
//   2. POST /v1/code/sessions/{id}/bridge  → {worker_jwt, expires_in, ...}
//   3. createV2ReplTransport(worker_jwt)   → SSE + CCRClient
//   4. createTokenRefreshScheduler        → proactive /bridge re-call
//
// No register/poll/ack/stop/heartbeat/deregister environment lifecycle.
```

四步就建立了连接。相比 env-based 的：注册环境 → 轮询工作 → ACK → heartbeat 续约 → 停止工作 → 注销环境，这是极简化的。

## 为什么可以省？

env-based 路径之所以需要这么多步骤，是因为它解决的是一个**多方调度问题**：

- 一个组织可能有多台机器注册了 environment
- 服务端需要把 work 分发给合适的 environment
- 分发出去的 work 需要 ACK，防止重复处理
- 进行中的 work 需要 heartbeat，防止僵尸任务

env-less 规避了这个问题，因为它的场景假设不同：**一个用户，一台机器，当前 REPL 会话**。没有"多个候选环境"的调度问题，也没有"任务被谁接走了"的竞争问题。直接创建 session、直接获取 worker_jwt、直接建连。

## 连接流程的变化

env-based 的 work 分发模型：

```
服务端维护 work 队列
→ client 轮询（poll）
→ server 弹出一条 work
→ client ACK
→ client 开始执行
→ client heartbeat（每 N 秒）
→ client 完成，stopWork
```

env-less 的直连模型：

```
client 主动创建 session
→ 获取 worker_jwt（/bridge endpoint）
→ 建立 SSE + CCRClient 双向连接
→ 开始执行（client 是主动方，不是接受分配的被动方）
```

这个倒转很重要：**client 从任务的接受者，变成了任务的发起者**。

## token 刷新的区别

env-based 路径里，token 过期有两条处理路径：

```typescript
// v1：直接把新 OAuth token 推给 session handle
handle.updateAccessToken(oauthToken)

// v2：调用 reconnectSession 触发服务端重新分发
api.reconnectSession(environmentId, sessionId)
```

v2 之所以不能直接推新 token，是因为 CCR worker 端点要验证 JWT 里的 `session_id` claim，OAuth token 不满足这个要求。需要服务端重新生成 worker_jwt。

env-less 路径的 token 刷新是**主动预防式的**：`createTokenRefreshScheduler` 在 JWT 过期前 5 分钟就触发 `/bridge` 重新调用，换一个新的 worker_jwt，再用新 JWT 重建 transport。不等到 401 再处理。

这是一个有意义的工程决策：被动处理（等到 401 再重试）会导致正在进行的任务中断；主动刷新（提前换 token）让中断几乎不可见。

## 失去的是什么

| 能力 | env-based | env-less |
|------|-----------|----------|
| 多 environment 调度 | 有 | 无 |
| 任务租约（lease） | 有 | 无（session 即租约） |
| 容量管理（max_sessions） | 有 | 无 |
| 组织级工作位展示 | 有 | 无 |
| daemon 模式支持 | 有 | 无（REPL-only） |

失去这些能力，对于**单用户、单机、REPL 场景**来说是没有损失的。这正是 env-less 的设计范围。

注释里也明确说了：

> Gated by `tengu_bridge_repl_v2` GrowthBook flag in initReplBridge.ts.
> REPL-only — daemon/print stay on env-based.

## 实现复杂度的对比

env-based `initBridgeCore` 约 2400 行，env-less `initEnvLessBridgeCore` 约 300 行。这个差距大部分来自环境调度、多会话管理、heartbeat 循环的逻辑。

但"更少行数"不代表更简单——两者解决的问题本来就不同。更准确的描述是：env-less 在一个**约束更强的假设下**（单用户、单机、REPL），实现了更直接的连接路径。

## 面试指导

这是一个很好的"架构取舍"题型。当面试官问"你会怎么简化这个系统"时，优秀的回答需要：

1. **先说清楚被简化部分解决的是什么问题**（环境调度、多方竞争、租约保障）
2. **再说在哪些假设下这些问题消失了**（单用户、单机、REPL-only）
3. **最后说明简化后失去了哪些能力**，以及这些能力在当前假设下是否必要

"在更强的约束下用更简单的实现"比"无条件简化"要有说服力得多。
