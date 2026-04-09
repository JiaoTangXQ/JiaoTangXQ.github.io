---
title: "leaderPermissionBridge 说明团队秩序要跨出组件树继续成立"
slug: "09-06-03-leaderpermissionbridge"
date: 2026-04-09
topics: [多Agent协作]
summary: "团队权限不是纯 React 组件内事务，因为 worker 执行循环根本不在组件树里。 `leaderPermissionBridge.ts` 用模块级变量注册 `setToolUseConfirmQ..."
importance: 1
---

# leaderPermissionBridge 说明团队秩序要跨出组件树继续成立

团队权限不是纯 React 组件内事务，因为 worker 执行循环根本不在组件树里。

## 实现链

`leaderPermissionBridge.ts` 用模块级变量注册 `setToolUseConfirmQueue` 和 `setToolPermissionContext`。`inProcessRunner.ts` 这样的非 React 代码就能拿到这些 setter，把 worker 的 ask 权限请求重新送进 leader UI。

这说明 Claude Code 的团队制度必须跨出组件树继续成立，否则执行层和界面层会脱节。

## 普通做法

普通做法会把权限逻辑尽量关在 React 组件内，非 UI 层尽量不碰它。

## 为什么不用

Claude Code 在这里没法保持那种“漂亮分层”，因为团队审批天然跨越执行层和界面层。它与其假装不耦合，不如明明白白建一座桥。

## 代价

代价就是模块级桥天然有全局状态味道，测试和卸载都要格外小心。
