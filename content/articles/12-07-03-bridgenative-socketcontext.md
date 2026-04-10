---
title: "createChromeContext：制度先于线路，两条路共用一部宪法"
slug: "12-07-03-bridgenative-socketcontext"
date: 2026-04-09
topics: [外延执行]
summary: "createChromeContext() 在决定走 bridge 还是 native socket 之前，先把身份、日志、socket 路径、配对记忆、权限模式、遥测边界统一钉成一个 context。线路可以分叉，制度不能分裂。"
importance: 1
---

# createChromeContext：制度先于线路，两条路共用一部宪法

`createChromeContext()` 做的第一件事不是选择连接线路，而是组装一个共享的上下文对象：

```typescript
const context = {
  socketPath,
  getSocketPaths,
  bridgeConfig,
  logger,
  trackEvent,
  onExtensionPaired,
  initialPermissionMode,
  // ...
};
```

然后才根据当前环境决定：这次走 bridge（远程连接），还是走 native socket（本地连接）。

## 两条线路，一套规则

`bridge` 和 `native socket` 在技术上是不同的连接方式：

- **bridge**：通过云端中转，跨网络连接 Claude Code 和浏览器扩展
- **native socket**：Unix domain socket，本地进程间通信

如果给这两条线路各自维护一套规则，系统就会出现两种人格：本地连接时一套日志格式，桥接时另一套；本地连接时一套权限检查逻辑，桥接时绕过；本地配对有记忆，桥接配对是一次性的……

把所有共同规则放进 `context`，两条线路都从这个 context 里读取，就消灭了这种分裂的可能：无论走哪条线，日志、权限、配对记忆都来自同一个来源，行为是一致的。

## 问题诊断的价值

当生产环境出现问题时，「线路」是不同的（不同的连接方式，不同的网络路径），但「制度」是相同的（日志格式一样，权限逻辑一样，事件追踪一样）。

这意味着排查问题时，工程师可以用同一套工具和知识处理 bridge 问题和 socket 问题，而不是需要「bridge 专家」和「socket 专家」各说各的。制度统一带来的是系统可理解性的统一。
