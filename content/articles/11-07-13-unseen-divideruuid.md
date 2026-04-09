---
title: "unseen divider 按 uuid 前缀认源头，说明拆成多块以后也得认出同一条消息"
slug: "11-07-13-unseen-divideruuid"
date: 2026-04-09
topics: [终端界面]
summary: "`computeUnseenDivider()` 会先找出第一条真正可渲染的未读消息，再把它的 `uuid` 交给 `Messages.tsx` 做分界判断。`Messages.tsx` 用的是 `u..."
importance: 1
---

# unseen divider 按 uuid 前缀认源头，说明拆成多块以后也得认出同一条消息

## 实现链
`computeUnseenDivider()` 会先找出第一条真正可渲染的未读消息，再把它的 `uuid` 交给 `Messages.tsx` 做分界判断。`Messages.tsx` 用的是 `uuid.slice(0, 24)` 这个公共前缀，因为 `deriveUUID()` 拆块后会保留这 24 位，方便认回同一条原始消息。

## 普通做法
普通列表通常直接按完整 id 或数组位置判断分界，不太会考虑“同一条消息被拆成多块后还要认得出来”。

## 为什么不用
Claude Code 的一条消息经常会被拆成多个渲染块，完整 uuid 可能已经不是同一个展示单元的最好标识。用前缀认源头，才能让分界线跟着消息的出生身份走，而不是跟着表面块数走。

## 代价
代价是这里和 uuid 生成约定绑得很紧，拆分规则要一直保持一致。好处是消息被拆开后，分界线仍然知道谁是一家。
