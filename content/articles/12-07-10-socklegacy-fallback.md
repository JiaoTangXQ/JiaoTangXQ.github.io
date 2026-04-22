---
title: "getAllSocketPaths 扫现役 sock 也保 legacy fallback"
slug: "12-07-10-socklegacy-fallback"
date: 2026-04-09
topics: [外延执行]
importance: 1
---

# getAllSocketPaths 扫现役 sock 也保 legacy fallback

`getAllSocketPaths()` 的返回值不只包含当前版本规则生成的 socket 路径，还会追加 legacy fallback 路径：

```typescript
function getAllSocketPaths(): string[] {
  const current = scanCurrentSocketDir();   // 当前版本的路径
  const legacy = getLegacySocketPaths();    // 旧版本可能留下的路径
  return [...current, ...legacy];
}
```

## 为什么要保留 legacy 路径

浏览器桥是一个长连接设施。用户可能在某次 Claude Code 启动后，建立了桥连接，然后升级了 Claude Code——但浏览器扩展那边还没重连，它仍然在尝试连接旧版本的 socket 路径。

如果新版本完全忽略旧路径，升级后浏览器扩展就连不上了，用户会看到一个「扩展已安装但连接失败」的状态。他们不知道为什么，需要重启 Chrome 或 Claude Code 才能修复。

把 legacy 路径加进候选列表，就给了老扩展一个找到新进程的机会——或者反过来，给新进程一个找到还在监听旧路径的组件的机会。

## 历史债是现实，不是技术耻辱

工程里总有一种冲动：新版本应该只认新规则，旧的东西统统清掉，代码更干净。

但「干净」有代价：用户的升级体验。每次版本变化都要求用户手动断开再重连，是把工程整洁的成本转移给用户承担。

Legacy fallback 的代码确实「不纯粹」，有一些历史味道。但它在为用户承担升级代价，减少那些「明明装了，为什么连不上」的迷惑时刻。这是一种务实的成熟：接受系统有历史，为历史留一条路。
