---
title: "为什么 Logo 也要 React.memo"
slug: "11-07-10-logomemo"
date: 2026-04-09
topics: [终端界面]
summary: "Messages.tsx 里的 LogoHeader 被 React.memo 包住，内部放 LogoV2 和 StatusNotices。Logo 看起来是静态装饰，但在长会话的重绘压力下，让它脱离消息更新的渲染周期有实际意义。"
importance: 1
---

# 为什么 Logo 也要 React.memo

`Messages.tsx` 里：

```typescript
const LogoHeader = React.memo(function LogoHeader() {
  return (
    <>
      <LogoV2 />
      <StatusNotices />
    </>
  );
});
```

Logo 被 `React.memo` 包住了。

## 直觉上这显得多余

Logo 不会变。`LogoV2` 渲染的是一个固定的 ASCII 艺术字或图标，`StatusNotices` 只在真正有通知时才有内容。大多数时候，这两个组件看起来「永远一样」，memo 似乎什么都不做。

## 长会话里的实际代价

`Messages.tsx` 是一个非常活跃的组件。每当消息列表更新——也就是每次助手流式输出一段文字、每次工具调用返回结果——这个组件都会重新渲染。在长会话里，这可以是每秒好几次。

没有 memo，`LogoHeader` 在每次父组件更新时都会参与重渲染。单次渲染的成本很低，但它处于整棵树的最上层，它的重渲染会触发它下面所有子树的重渲染检查。在主线程空间有限的终端环境里，任何不必要的计算都是摩擦。

更重要的是：`StatusNotices` 有自己的状态订阅。在没有 memo 的情况下，每次 `Messages.tsx` 更新都会重新执行 `StatusNotices` 里的状态读取逻辑，即使消息区的更新与通知状态完全无关。

## memo 在这里做的事

用 `React.memo` 包住 `LogoHeader`，在说：**页头部分的重渲染不应该由消息列表的变化触发**。只有 Logo 或通知本身的状态改变，才需要重渲染页头。

这是一个关于「哪个更新应该触发哪个重渲染」的架构决策，而不是简单的性能优化。它在把组件树里的更新传播路径明确化：消息区更新 → 消息区重渲染，但不波及页头。
