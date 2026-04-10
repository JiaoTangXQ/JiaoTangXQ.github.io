---
title: "故障恢复推演：WebSocket 断线 5 秒后，Claude Code 内部发生了什么？"
slug: "08-05-02-sessionswebsocket"
date: 2026-04-09
topics: [远端与边界]
summary: "不同的 WebSocket close code 触发不同的恢复策略：4003 立即终止，4001 限时重试，其他 code 按退避算法重连——这三条路径的选择，根植于对「哪种断线可恢复、哪种不可恢复」的精确判断。"
importance: 1
---

# 故障恢复推演：WebSocket 断线 5 秒后，Claude Code 内部发生了什么？

## 断线的时刻

假设场景：用户正在使用 Remote Control，WebSocket 连接意外断开。

在 0 秒：`onclose` 事件触发，`SessionsWebSocket` 收到 close 事件，包含 `code` 字段。

接下来发生什么，完全取决于这个 `code` 的值。

## 三条恢复路径

### 路径一：close code 4003 — 立即终止

```
0s: WebSocket close code=4003
0s: 不重试
0s: 向上层抛出永久性错误
```

`4003` 是"unauthorized"——鉴权失败。在这种情况下重连是没有意义的，新的连接会以同样的方式失败。

这是**快速失败（fail fast）**的原则：不做无效努力，立刻报错，让上层决定如何处理（通常是提示用户重新登录）。

### 路径二：close code 4001 — 有限重试

```
0s:  WebSocket close code=4001
0s:  开始重试计数
Ns:  等待固定间隔
Ns:  重新建立 WebSocket 连接，重新获取 token
?:   如果重试次数超过上限 → 报告永久失败
?:   如果重连成功 → 恢复正常
```

`4001` 比较特殊：它通常表示 session 暂时不可见，可能正在 compaction（上下文压缩）或其他服务端内部操作中。

注释里的原话：

> like `session not found` which can be transient during compaction window

给一个有限的重试窗口，而不是无限重连，也不是直接放弃。如果在重试窗口内服务端恢复了，连接就继续；如果重试耗尽了还没恢复，才报告失败。

### 路径三：其他 close code — 退避重连

```
0s:   WebSocket close code=1006（异常断开）
0s:   启动退避计时器
~1s:  尝试重连，重新获取 token
?:    如果失败，退避时间加倍
?:    如果超过最大重试次数 → 报告失败
?:    如果成功 → 恢复
```

网络抖动、服务端重启、代理超时都会产生这类断线。退避重连是处理这类情况的标准做法：第一次快速重试，之后逐渐放慢，给网络和服务端恢复的时间。

## 每次重连都要重新获取 token

这是一个容易被忽视但很重要的细节：每次建立新的 WebSocket 连接，都重新取 token，而不是复用之前的。

原因：WebSocket 连接可能断了很长时间（网络不稳定、机器睡眠唤醒），之前的 token 可能已经过期。如果复用旧 token，新连接会立刻以 4003 失败，触发"永久失败"路径——即使重新获取 token 本可以救回这个连接。

`remoteIO.ts` 里的设计体现了这个考虑：

```typescript
const refreshHeaders = (): Record<string, string> => {
  const h: Record<string, string> = {}
  const freshToken = getSessionIngressAuthToken()
  if (freshToken) {
    h['Authorization'] = `Bearer ${freshToken}`
  }
  return h
}
```

transport 在重连时调用 `refreshHeaders()`，而不是捕获闭包里的旧 token。父进程可以通过 token 文件或环境变量刷新 token，transport 在重连时自动读取最新值。

## Keep-alive 机制

`remoteIO.ts` 里还有一个 keep-alive 帧的定时发送：

```typescript
const keepAliveIntervalMs = getPollIntervalConfig().session_keepalive_interval_v2_ms
if (this.isBridge && keepAliveIntervalMs > 0) {
  this.keepAliveTimer = setInterval(() => {
    void this.write({ type: 'keep_alive' })
  }, keepAliveIntervalMs)
}
```

为什么需要主动发 keep-alive？

上游的 Envoy 代理有 idle timeout——如果一段时间内没有数据传输，连接会被静默关闭。对于等待用户输入的空闲会话，正常情况下长时间没有消息，Envoy 就会断开连接。

keep-alive 帧本身没有业务含义（接收方直接过滤掉），但它作为心跳维持了 TCP 连接的活跃状态，阻止了 idle timeout。

注意：`keepAliveTimer.unref?.()`——使用了 `unref()` 让 timer 不阻止进程退出。即使 keep-alive timer 还在运行，如果没有其他活跃操作，进程可以正常退出。

## 退避算法的选择

指数退避（exponential backoff）是处理网络错误重连的常见算法。`bridgeMain.ts` 里的退避配置：

```typescript
const DEFAULT_BACKOFF: BackoffConfig = {
  connInitialMs: 2_000,
  connCapMs: 120_000,    // 最大 2 分钟
  connGiveUpMs: 600_000, // 10 分钟后放弃
  generalInitialMs: 500,
  generalCapMs: 30_000,
  generalGiveUpMs: 600_000,
}
```

"Give up"时间（600 秒）的存在是关键：系统不会无限重试。如果 10 分钟内都无法重连，判断为不可恢复，让用户决定下一步。

## 系统睡眠检测

还有一个有趣的机制：睡眠唤醒检测。

```typescript
function pollSleepDetectionThresholdMs(backoff: BackoffConfig): number {
  return backoff.connCapMs * 2
}
```

当距上次 poll 的时间间隔超过阈值（2 × 最大退避时间 = 4 分钟），判断为"系统可能发生了睡眠/唤醒"。此时重置错误预算，给连接重建一个新的起点——避免系统从睡眠中醒来后，因为之前积累的重试次数已耗尽而立刻放弃重连。

## 面试指导

"如何设计一个健壮的 WebSocket 重连机制"是常见的系统设计题。

关键要点：

1. **区分可恢复和不可恢复的错误**：用 close code 而不是统一处理
2. **退避而非固定间隔**：避免惊群效应，给服务端恢复时间
3. **设定放弃时间**：无限重试不是鲁棒性，而是掩盖问题
4. **每次重连刷新凭证**：凭证可能在断线期间过期
5. **keep-alive 主动维持连接**：对抗上游 idle timeout

这五点各解决一个具体问题，而不是"尽量多重试"这样模糊的策略。
