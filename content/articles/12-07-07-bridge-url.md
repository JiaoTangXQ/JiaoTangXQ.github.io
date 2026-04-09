---
title: "bridge URL 按用户类型和环境分层解算，说明外延桥也先分清谁能走哪座桥"
slug: "12-07-07-bridge-url"
date: 2026-04-09
topics: [外延执行]
summary: "浏览器 bridge 不是一条谁都能走、在哪都一样的通道。Claude Code 会先看用户类型、feature flag、本地开发环境还是预发环境，再决定这次到底该连哪一座桥。也就是说，桥本身就是分..."
importance: 1
---

# bridge URL 按用户类型和环境分层解算，说明外延桥也先分清谁能走哪座桥

浏览器 bridge 不是一条谁都能走、在哪都一样的通道。Claude Code 会先看用户类型、feature flag、本地开发环境还是预发环境，再决定这次到底该连哪一座桥。也就是说，桥本身就是分层制度的一部分，而不是单纯的网络地址。

这类设计的价值在于，它把“谁能走哪条路”提前讲清楚了。外延能力越强，越不能把所有人都扔进同一条隧道里跑。

## 实现链
`getChromeBridgeUrl()` 会先看是不是 `ant` 或命中特性开关，再根据 `USE_LOCAL_OAUTH`、`LOCAL_BRIDGE`、`USE_STAGING_OAUTH` 决定走本地、staging 还是生产 bridge。桥不是唯一的，而是分层解算。

## 普通做法
普通做法是把 bridge URL 写死成一个地址。

## 为什么不用
Claude Code 不写死，因为 dogfood、本地开发、staging 和外部用户本来就不该走同一座桥。

## 代价
代价是环境分支增多，配置错误时也更难排查。

