---
title: "unseen divider 用 UUID 前缀，因为拆块后要认出同一条消息"
slug: "11-07-13-unseen-divideruuid"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# unseen divider 用 UUID 前缀，因为拆块后要认出同一条消息

「你上次读到这里，以下是新内容」——这条分界线需要一个稳定的定位机制。

## 流程

1. `computeUnseenDivider()` 遍历消息列表，找到第一条「真正可渲染的未读消息」，记录它的 UUID（完整 UUID）
2. `FullscreenLayout.tsx` 把这个 UUID 作为 `firstUnseenUuid` 传给 `Messages.tsx`
3. `Messages.tsx` 渲染时，对每条消息检查：`message.uuid.slice(0, 24) === firstUnseenUuid.slice(0, 24)`，如果匹配，在这条消息前面插入分界线

## 为什么用前 24 位而不是完整 UUID

`deriveUUID()` 在从原始消息派生块 UUID 时，会在前 24 位保留原始消息的 UUID 前缀，后面追加块的位置信息。

这意味着：同一条原始消息拆成三块，这三块的 UUID 是：
```
abcdefghijklmnopqrstuvwx-0000
abcdefghijklmnopqrstuvwx-0001
abcdefghijklmnopqrstuvwx-0002
```
前 24 位完全相同。

如果用完整 UUID 匹配，`computeUnseenDivider()` 找到的是某一块的完整 UUID，而 `Messages.tsx` 里的消息可能是该条原始消息的另一块，完整 UUID 不匹配，分界线就插不到正确的位置。

用前 24 位，只要是同一条原始消息的任何一块，都能匹配，分界线能正确插在「这条消息的第一块」之前。

## 这个约定需要维护

这里有一个隐式约定：`deriveUUID()` 保留前 24 位，`computeUnseenDivider()` 和 `Messages.tsx` 都依赖这个约定。如果 `deriveUUID()` 改变了派生规则，不再保留前缀，这里的分界逻辑就会悄悄失效。

这是架构上「约定优于配置」的典型代价：代码简洁，但依赖方需要了解约定，约定变更时需要一起更新。
