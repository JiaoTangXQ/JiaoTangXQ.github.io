---
title: "isIdleNotification()：过滤的不是数据，是噪音的定义"
slug: "11-04-08-idle-notification"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# isIdleNotification()：过滤的不是数据，是噪音的定义

`PromptInputQueuedCommands.tsx` 在处理排队命令时有一步过滤：

```typescript
if (isIdleNotification(command)) continue;
```

`isIdleNotification()` 从命令的 JSON 内容里识别 `idle_notification` 类型，命中就跳过，不渲染到排队区。

## 什么是 idle_notification

后台进程会定期向主进程汇报「我还活着，没有新进展」。这类心跳消息对系统运行来说有价值，但对用户来说意义为零——他们不需要知道系统每隔几秒在说「暂无新消息」。

`idle_notification` 就是这类后台心跳。它的存在是为了让基础设施正常运转，不是为了让用户在排队区里看到「系统处于空闲状态」这样的通知。

## 过滤是信息设计，不是数据清洗

把 `idle_notification` 过滤掉，表面上是在删数据，实质上是在回答一个设计问题：**排队区的职责是什么？**

答案是：告知用户「接下来会发生什么」，帮助用户管理下一步操作。

`idle_notification` 对这个职责没有贡献。它不告诉用户下一步该做什么，也不代表任何需要注意的事件。让它出现在排队区，只会稀释真正有用的通知，让用户在「有信息」和「这只是心跳」之间做无谓的区分。

## 类似决策的普遍性

在任何消息驱动的系统里，都存在「技术上合法但用户不应该看到」的消息。心跳、内部状态同步、调试事件、性能打点……这些东西在基础设施层面完全正当，但如果不在渲染层过滤掉，用户界面就会变成一个把内部状态暴露给用户的技术日志窗口。

`isIdleNotification()` 是这类过滤最简单的例子：知道什么不该出现，比知道什么该出现同样重要。
