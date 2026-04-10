---
title: "分界线是独立的兄弟节点，不是消息行的包装"
slug: "11-07-14-divider"
date: 2026-04-09
topics: [终端界面]
summary: "renderMessageRow() 用 flatMap 返回 [divider, wrappedRow] 这样的独立兄弟节点，而不是把 divider 塞进每一行的包装组件里。这样分界线的开关不会触发所有消息行的重建。"
importance: 1
---

# 分界线是独立的兄弟节点，不是消息行的包装

`Messages.tsx` 里，`renderMessageRow()` 返回的是：

```typescript
// 使用 flatMap，返回数组
return [
  showDivider ? <UnseenDivider key="divider" /> : null,
  <MessageRowWrapper key={message.uuid} message={message} />,
].filter(Boolean);
```

分界线和消息行是**兄弟节点**，不是父子节点。

## 如果换成包装方式

想象另一种实现：

```tsx
<MessageRowWithOptionalDivider 
  showDivider={showDivider} 
  message={message} 
/>
```

这个包装组件会把 divider 和消息行打包在一起。当 `showDivider` 从 `false` 变成 `true`（有新消息时），这个包装组件的 props 变化，React 会重新渲染这个组件——包括里面的 `MessageRowWrapper`，即使消息本身完全没变。

在一个有很多条消息的列表里，分界线出现时，会触发它对应的消息行以及整个包装层的重渲染。

## 兄弟节点的优势

用 `flatMap` 返回兄弟节点时：

- `UnseenDivider` 是独立的 React 节点
- `MessageRowWrapper` 是独立的 React 节点
- 两者互不影响

分界线从无到有（或从有到无），React 只需要挂载/卸载 `UnseenDivider` 这一个节点。相邻的 `MessageRowWrapper` 的 props 没有变化，React 不会重渲染它。

这是 React 渲染优化里一个基础但重要的原则：**把变化的东西和不变的东西拆成独立节点**，让 React 的 diff 算法只处理真正需要更新的部分，而不是因为包装关系把不相关的内容一起拉进更新。
