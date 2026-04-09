---
title: "teleport先铺的是认证、组织和会话-API-地基"
slug: "08-09-01-teleport-api"
date: 2026-04-09
topics: [远端与边界]
summary: "- `utils/teleport/api.ts` 的第一层不是“远端执行”，而是 `prepareApiRequest()`：先确认必须是 Claude.ai OAuth，不是单纯 API key；..."
importance: 1
---

# teleport先铺的是认证、组织和会话-API-地基

## 实现链
- `utils/teleport/api.ts` 的第一层不是“远端执行”，而是 `prepareApiRequest()`：先确认必须是 Claude.ai OAuth，不是单纯 API key；再拿到 `orgUUID`，再统一生成带组织头的 Sessions API 请求。
- 后面的列会话、发事件、更新标题，全都建立在这层认证和组织地基之上。也就是说，teleport 先接的是产品会话世界，再接执行世界。

## 普通做法
- 普通远端终端更像一把 SSH key 或一个 host 地址，有凭据就连，不太关心组织和产品层会话。
- 这种模式很适合基础设施工具。

## 为什么不用
- Claude Code 没把 teleport 做成“简单远端终端”，因为它的远端会话是要在 Claude.ai 里被列出、被复用、被组织策略约束的。
- 如果没有组织和会话 API 这层地基，远端工作就只是孤立执行，不是产品里的 session。

## 代价
- 代价是 teleport 明显依赖 Claude.ai 账户体系，脱离这层产品地基就不好单独成立。
- 但这和它的目标是一致的：它要搬的是 Claude Code 的远端工作台，不是通用 SSH 客户端。
