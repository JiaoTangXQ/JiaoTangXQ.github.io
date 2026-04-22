---
title: "bridge URL 分层解算：谁能走哪座桥，代码说清楚"
slug: "12-07-07-bridge-url"
date: 2026-04-09
topics: [外延执行]
importance: 1
---

# bridge URL 分层解算：谁能走哪座桥，代码说清楚

`getChromeBridgeUrl()` 的逻辑大致是：

```typescript
function getChromeBridgeUrl(): string {
  if (isAntUser()) {
    if (USE_LOCAL_OAUTH || LOCAL_BRIDGE) return LOCAL_BRIDGE_URL;
    if (USE_STAGING_OAUTH) return STAGING_BRIDGE_URL;
    return ANT_PROD_BRIDGE_URL;
  }
  return EXTERNAL_PROD_BRIDGE_URL;
}
```

用户类型（内部/外部）+ 环境变量（本地开发/staging/生产）的组合，决定最终走哪座桥。

## 为什么要分这么多层

一个固定的 bridge URL 写死了，当然最简单。但实际上不同用户和不同环境有完全不同的需求：

**内部工程师本地开发**：需要连到本机运行的 bridge，不走云端中转，才能调试新功能。

**内部工程师 staging 测试**：需要连到 staging 环境的 bridge，验证还没上线的改动。

**内部工程师正式使用**：连内部专用的生产 bridge（可能有更高的权限或容量）。

**外部用户**：连公开生产 bridge。

把这四种情况都连到同一个地址是不合理的：本地开发时连公开生产，每次调试都影响线上；外部用户连内部地址，可能访问到不该访问的内容。

## 分层的可维护性

分层的另一个好处是可读性：代码里清楚写明了「什么条件对应什么地址」。新工程师加入，看一眼 `getChromeBridgeUrl()`，就知道整个分层结构。如果有哪个环境的地址要改，改一处，不会漏改。

相比之下，把地址散落在多处代码里，靠注释说明「这里用于 staging，那里用于本地」，维护起来就是依赖注释而不是依赖代码结构——注释会过时，代码不会（当代码还在跑时）。
