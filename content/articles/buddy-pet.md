---
title: "/buddy pet 只记一个时间戳，说明亲密反馈也被做成短促事件"
slug: "buddy-pet"
date: 2026-04-09
topics: [终端界面]
summary: "`AppStateStore.ts` 里只存了 `companionPetAt` 这个时间戳，`CompanionSprite.tsx` 再用它和 `PET_BURST_MS = 2500` 算出短暂..."
importance: 1
---

# /buddy pet 只记一个时间戳，说明亲密反馈也被做成短促事件

## 实现链

`AppStateStore.ts` 里只存了 `companionPetAt` 这个时间戳，`CompanionSprite.tsx` 再用它和 `PET_BURST_MS = 2500` 算出短暂的爱心飘动效果。也就是说，pet 的状态是一次性事件，而不是常驻现实。

## 普通做法

普通做法可能会把每次互动都写成一个长期状态，久而久之，状态世界就被零碎情绪占满了。那样虽然显得热闹，但很拖。

## 为什么不用

Claude Code 只记时间戳，是因为亲密反馈只需要留下痕迹，不需要变成长命状态。短促出现、短促退场，反而更像一个可控的互动事件。

## 代价

代价是视觉反馈必须靠 tick 和时间窗重建，不能从状态里直接读出完整历史。换来的则是状态世界不会因为一个宠爱动作就多出长期包袱。
