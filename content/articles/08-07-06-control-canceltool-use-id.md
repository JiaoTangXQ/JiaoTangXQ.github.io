---
title: "control_cancel还带回tool_use_id说明撤销也要精确落到界面对象"
slug: "08-07-06-control-canceltool-use-id"
date: 2026-04-09
topics: [远端与边界]
summary: "- `RemoteSessionManager.ts` 收到 `control_cancel_request` 时，会先从 `pendingPermissionRequests` 里找到原请求，再把 ..."
importance: 1
---

# control_cancel还带回tool_use_id说明撤销也要精确落到界面对象

## 实现链
- `RemoteSessionManager.ts` 收到 `control_cancel_request` 时，会先从 `pendingPermissionRequests` 里找到原请求，再把 `tool_use_id` 一并传回 `onPermissionCancelled()`。
- 这让本地 UI 能精确删掉队列里那一个审批项，而不是模糊地“关掉最近那个弹窗”。

## 普通做法
- 普通做法是取消时只带 requestId，甚至只说“当前审批取消了”。
- 单请求场景下这种简化完全够用。

## 为什么不用
- Claude Code 没假设永远只有一个审批，因为远端工具调用可以并发发生。没有 `tool_use_id`，本地界面就很难稳定映射到正确对象。
- 所以这里连撤销都保持对象级精度，而不是做成模糊广播。

## 代价
- 代价是要额外维护 `pendingPermissionRequests` 映射，多一层状态同步。
- 但多请求并存时，这层映射几乎是必需品。
