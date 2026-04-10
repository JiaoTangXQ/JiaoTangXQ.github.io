---
title: "In-Process MCP Server：为什么接口看起来像 stdio 但内部不起子进程"
slug: "183-in-process-serverstdio"
date: 2026-04-09
topics: [MCP, 架构设计, Claude Code 内核]
summary: "Claude Code 的 InProcessTransport 让 MCP server 在同一进程内运行，外表仍符合 stdio 接口协议，但内部用消息队列替代了进程通信。这个设计是接口层克制复杂度的典型案例。"
importance: 0.9
---

# In-Process MCP Server：为什么接口看起来像 stdio 但内部不起子进程

面试题版本：**"Claude Code 的 in-process MCP server 和普通 stdio MCP server 外部行为相同，但内部实现完全不同。这种设计的动机是什么？有什么取舍？"**

## 先看源码的证据

`src/services/mcp/InProcessTransport.ts` 是这个设计最直接的实现：

```typescript
class InProcessTransport implements Transport {
  private peer: InProcessTransport | undefined

  async send(message: JSONRPCMessage): Promise<void> {
    // 用微任务队列投递，避免同步调用栈溢出
    queueMicrotask(() => {
      this.peer?.onmessage?.(message)
    })
  }

  async close(): Promise<void> {
    this.closed = true
    this.onclose?.()
    if (this.peer && !this.peer.closed) {
      this.peer.closed = true
      this.peer.onclose?.()
    }
  }
}

export function createLinkedTransportPair(): [Transport, Transport] {
  const a = new InProcessTransport()
  const b = new InProcessTransport()
  a._setPeer(b)
  b._setPeer(a)
  return [a, b]
}
```

`createLinkedTransportPair()` 创建一对互相引用的 transport 对象，消息发送通过 `queueMicrotask` 而不是操作系统的管道。外部使用方拿到的是标准 `Transport` 接口，感知不到背后是进程间通信还是对象间调用。

## 为什么这么做

标准 MCP stdio server 会 fork 一个子进程，用 stdin/stdout 通信。这在大多数场景下没问题，但有几个具体代价：

**启动延迟**：每次需要 MCP server 时都要 fork 进程，Linux 上通常几十毫秒，Windows 更慢。对交互频繁的工具这个成本累加起来不可忽视。

**进程管理复杂度**：子进程需要监控、重启、清理。Claude Code 本身已经在管理 bash 进程、agent 进程、任务进程，再多一批 MCP 子进程会让进程表更杂乱，也让 shutdown 路径更脆弱。

**调试困难**：跨进程通信的日志是分开的，in-process 的执行可以共享日志上下文，出问题时更容易追踪。

in-process 方案的核心权衡：**用接口兼容性换掉物理隔离**。server 仍然通过标准 JSON-RPC 消息格式通信，协议层没有任何特殊假设，但传输层用内存队列替代了管道。

## 接口层的克制空间

这里有一个更深的设计哲学值得注意。`InProcessTransport` 实现了 `Transport` 接口，这意味着 MCP client 和 MCP server 代码完全不知道自己是否在进程内运行。它们只见到接口，不见实现。

`queueMicrotask` 而不是直接 `peer.onmessage()` 这个细节很重要：同步调用会导致调用栈里 client 在等 server，server 又在等 client 的情况，即经典的同步死锁。微任务延迟把请求-响应循环转成了事件循环里的正常调度，在不改变接口的前提下解决了一个实现层的并发问题。

这是接口层"替实现复杂度挡风"的具体体现：外部看到的是干净的 Transport 契约，内部解决了同步循环、进程生命周期、清理协调这些脏活。

## 什么时候不适用

in-process 并非没有缺点：

**安全隔离弱**：子进程可以给权限做沙箱，in-process server 和主进程共享内存空间。如果 MCP server 代码有 bug 或恶意行为，影响范围更大。Claude Code 在这里的假设是内建 MCP server 是可信代码。

**崩溃隔离差**：子进程崩溃不会带倒主进程，in-process 崩溃则会。对于不可信的第三方 MCP server，仍然应该用进程隔离。

所以 Claude Code 的实际策略是分层的：内建或高可信度的 MCP server 用 in-process，用户配置的外部 MCP server 仍然走 stdio 进程。`src/services/mcp/types.ts` 里的 `Transport` 类型包含 `'stdio' | 'sse' | 'http' | 'sdk'`，多种传输方式共存，统一的接口让调用方不需要关心差别。

## 面试角度的总结

这道题考的不是"in-process 比子进程快"这种表面结论，而是**接口稳定性和实现灵活性的分离**。Claude Code 的答案是：在接口层承诺 Transport 语义，在实现层自由选择物理机制。这让系统可以在不改任何上层代码的情况下，为不同 MCP server 选择最合适的传输方式。
