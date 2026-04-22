---
title: "MessageActionsSelectedContext 放在 divider 分支外，确保选中态不触发消息列表重算"
slug: "11-07-15-divider"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# MessageActionsSelectedContext 放在 divider 分支外，确保选中态不触发消息列表重算

`Messages.tsx` 的渲染结构中，`MessageActionsSelectedContext.Provider` 的放置位置是经过考虑的。

## Context provider 的更新传播

当一个 Context 的 value 变化时，React 会重渲染所有订阅了这个 Context 的组件。`MessageActionsSelectedContext` 的 value 是当前选中的消息 ID（用于显示消息操作按钮）。

用户点击一条消息、选中它，`selectedMessageId` 变化，触发 context value 更新。如果这个 Provider 包裹了整个消息列表，所有订阅了这个 context 的消息行都会重渲染——即使大多数消息行只是在做「我没有被选中，不显示操作按钮」这个简单判断。

## 与 divider 逻辑的分离

`unseen divider` 的插入位置取决于 `firstUnseenUuid`，这是一个随消息列表更新而变化的状态。把 `MessageActionsSelectedContext.Provider` 放在 divider 分支的外层，意味着两种状态变化的更新路径是独立的：

- 新消息来了 → divider 位置可能变化 → 只影响 divider 相关的渲染
- 用户点击了一条消息 → 选中态变化 → 只影响订阅了该 context 的组件

如果混在一起，两种变化就可能互相触发：用户点击消息时，divider 逻辑也跑一遍；新消息来时，选中态相关的渲染也被拉进来更新。

## Provider 位置是一种更新边界的声明

在 React 里，Context Provider 的位置不只是语义问题，也是更新传播边界的问题。把 Provider 放在哪里，就是在说「这个状态的变化只影响这个范围内的组件」。

有意识地调整 Provider 位置，让不同的状态变化在组件树里走不同的更新路径，是优化 React 更新传播的一种清晰有效的手段。
