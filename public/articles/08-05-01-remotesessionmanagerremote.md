---
title: "RemoteSessionManager说明remote先管的是会话生命"
slug: "08-05-01-remotesessionmanagerremote"
date: 2026-04-09
topics: [远端与边界]
summary: "- `RemoteSessionManager.ts` 同时持有 WebSocket 订阅、HTTP 发送和权限请求映射。它暴露的是 `connect()`、`sendMessage()`、`resp..."
importance: 1
---

# RemoteSessionManager说明remote先管的是会话生命

## 实现链
- `RemoteSessionManager.ts` 同时持有 WebSocket 订阅、HTTP 发送和权限请求映射。它暴露的是 `connect()`、`sendMessage()`、`respondToPermissionRequest()` 这类会话级动作，而不是零散网络函数。
- 这说明 remote 层首先在管理“一个远端会话怎么活着”，包括怎么连上、怎么接消息、怎么回复审批，而不是先追求网络调用最少。

## 普通做法
- 普通做法会把发消息、收消息、审批回调拆成几个独立 util，让上层自己拼。
- 这样文件会更薄，看起来职责也更单纯。

## 为什么不用
- Claude Code 没完全拆散，是因为远端会话的生命链本来就是连着的。谁负责订阅消息，通常也最清楚当前有哪些待审批请求、哪些回调该在断线时清理。
- 如果全拆成工具函数，上层反而要自己重新拼一遍状态机。

## 代价
- 代价是 `RemoteSessionManager` 必须知道的事情偏多，会显得不像一个“纯网络层”。
- 但这比把状态机碎成到处都是的小函数更容易守住一致性。
