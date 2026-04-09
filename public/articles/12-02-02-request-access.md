---
title: "request_access先处理整场会话许可，不让每一步都打断人"
slug: "12-02-02-request-access"
date: 2026-04-09
topics: [外延执行]
summary: "`computerUse` 最说明它不是散乱工具的地方，是它把许可问题放在整场会话上处理。`allowedTools` 能直接放行，不是因为它不危险，而是因为真正的审批已经前移到 `request_a..."
importance: 1
---

# request_access先处理整场会话许可，不让每一步都打断人

`computerUse` 最说明它不是散乱工具的地方，是它把许可问题放在整场会话上处理。`allowedTools` 能直接放行，不是因为它不危险，而是因为真正的审批已经前移到 `request_access` 这一步。

这种做法比“每点一次都再问一遍”更像成熟产品。它既承认桌面能力危险，又不让用户在连续操作里被无穷无尽的小确认打断。风险被集中处理，节奏才保得住。

## 实现链
`setupComputerUseMCP()` 的注释直接写明：这些工具会被塞进 `allowedTools`，不是因为它们天然安全，而是因为真正的审批前移到 `request_access`。在 `wrapper.tsx` 里，`onPermissionRequest`、`onAllowedAppsChanged`、`grantFlags`、`allowedApps` 会把这次授权记成整场会话的状态。

## 普通做法
最容易想到的做法是每次点击、输入、打开应用都再弹一次确认。

## 为什么不用
Claude Code 不用这种逐步审批，因为连续桌面操作会被确认框撕碎。它把风险集中在“先请求本轮要碰哪些应用和权限”，再让后续动作在同一授权现场里继续。

## 代价
代价是权限状态变成会话级对象，代码里要额外维护 `allowedApps`、`grantFlags`、锁和中断；但这比让用户每一步都被打断更像可用产品。

