---
title: "不认识的control请求也要回error说明远端协议不能靠沉默"
slug: "08-07-04-controlerror"
date: 2026-04-09
topics: [远端与边界]
summary: "- `RemoteSessionManager.ts` 在 `handleControlRequest()` 里只对 `can_use_tool` 走正常流程，其他未知 subtype 会立即发一个 ..."
importance: 1
---

# 不认识的control请求也要回error说明远端协议不能靠沉默

## 实现链
- `RemoteSessionManager.ts` 在 `handleControlRequest()` 里只对 `can_use_tool` 走正常流程，其他未知 subtype 会立即发一个 `control_response` 错误包回去。
- 这表示远端协议在这里遵守的是“明确失败”，而不是“沉默等超时”。

## 普通做法
- 普通实现很容易选择忽略未知控制消息，反正本地也不认识。
- 这样前向兼容看起来更松。

## 为什么不用
- Claude Code 没靠沉默，是因为远端服务端很可能正在等一个响应。你如果静默丢弃，它不会知道是本地不支持，还是网络已经断了。
- 从代码结构看，作者宁可尽早告诉对方“我不认识”，也不愿制造悬而未决的等待。

## 代价
- 代价是协议会显得更硬，新 subtype 上线前客户端更容易显式报错。
- 但对调试和恢复来说，这比无声挂起要好太多。
