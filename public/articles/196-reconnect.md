---
title: "失败与重接也是产品功能：为什么 reconnect 不是边角处理"
slug: "196-reconnect"
date: 2026-04-09
topics: [浏览器扩展, 容错设计, Claude Code 内核]
summary: "Claude Code 的浏览器 bridge 接入链里，reconnect 页的存在说明失败和重新建立连接被当成了正常工作流程的一部分来设计，而不是边角情况来修补。"
importance: 0.9
---

# 失败与重接也是产品功能：为什么 reconnect 不是边角处理

面试题版本：**"Claude Code 的浏览器 bridge 连接断开后有什么恢复机制？重连逻辑在代码里是如何组织的？为什么要专门设计 reconnect 流程，而不是让用户手动刷新？"**

## 连接为什么会断

Native Messaging bridge 连接比普通网络连接更脆弱，有多种断开原因：

1. **浏览器关闭了标签页或扩展**：Native Host 进程也被终止
2. **Claude Code 进程崩溃或被用户强制退出**：bridge 另一端消失
3. **用户锁屏或系统休眠**：进程被挂起，I/O 暂停，连接超时
4. **扩展被禁用再启用**：扩展重新初始化，旧连接失效
5. **Native Host 进程被操作系统 OOM 杀死**

这些场景在真实用户环境里都会发生，不是罕见的边角情况。

## reconnect 的设计要解决什么

**用户感知的连续性**：用户在浏览器里工作，Claude Code 在后台运行，突然 bridge 断了。用户期望的体验是"系统应该自动重新连上"，而不是"我得去找为什么工具不工作了"。

**状态恢复**：如果重连时有正在进行的任务，需要评估这些任务是否仍然有效，是否需要重新发起。

**用户干预的最小化**：对于可以自动恢复的断线，不应该打扰用户。对于需要用户操作的情况（比如权限变化），用清晰的界面引导用户操作。

## 源码里的 reconnect 机制

`src/bridge/createSession.ts` 和 `src/bridge/directConnectManager.ts` 管理 bridge 会话的生命周期。bridge 连接有明确的状态机：

```
connecting -> connected -> disconnected -> reconnecting -> connected
                                       \-> failed (need user action)
```

`reconnecting` 和 `failed` 是两种不同的断开状态：
- `reconnecting`：可以自动恢复，系统在后台尝试重连，不需要用户感知
- `failed`：需要用户干预（比如 Native Host 没有安装、权限被撤销），显示 reconnect 页面引导用户操作

`src/bridge/bridgeEnabled.ts` 持续监控 bridge 的可用性，`capacityWake.ts` 处理系统从休眠唤醒后的重连。

## 缓存检测的作用

重连时，系统可能遇到一种微妙情况：连接在物理层面还在，但内容已经过时了（stale）。

比如，Claude Code 主进程重启了，bridge 重新连接，但扩展侧缓存的能力列表（哪些工具可用、哪些 MCP server 已连接）来自旧进程。新进程可能有不同的工具集。

缓存检测的任务是：重连后验证缓存的状态是否仍然有效，必要时重新同步。这在 `src/bridge/bridgeDebug.ts` 和状态同步逻辑里有处理。

## "设计进去"而不是"发现了再修"

专门为 reconnect 设计状态机和用户界面，意味着这个场景在开发阶段就被当作正常工作流来对待，而不是 QA 发现后再补丁。

两种态度的区别在设计结果上很明显：

**事后修补**：连接断开时用户看到一个通用的错误提示，需要自己判断该怎么做。

**提前设计**：
- 可以自动恢复的情况：静默重连，用户不感知
- 需要用户操作的情况：清晰的界面说明原因（"Native Host 未安装"、"权限被撤销"），提供一键操作按钮
- 需要保留状态的情况：重连后自动恢复到断线前的工作状态

## 面试角度的总结

产品级接入链和原型级接入链的核心区别之一：**失败路径是否被当作需要设计的功能**。reconnect 不是"正常流程之外的边角处理"，它是接入链完整性的一部分。Claude Code 专门设计 reconnect 状态机和用户界面，是因为在真实用户环境里，连接断开和重建是完全可以预期的正常事件，系统必须优雅地处理，而不是让用户自己解决。
