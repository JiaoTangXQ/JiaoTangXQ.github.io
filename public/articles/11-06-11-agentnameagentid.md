---
title: "agentName 和 agentId 双键映射：一个 teammate 可以有两种合法写法"
slug: "11-06-11-agentnameagentid"
date: 2026-04-09
topics: [终端界面]
summary: "TaskListV2.tsx 建 teammateActivity 和 activeTeammates 时，同时写入 agentName 和 agentId 两个键，颜色映射也先按 teamContext.teammates 收口。这是在处理一个同一实体有多种身份标识的实际问题。"
importance: 1
---

# agentName 和 agentId 双键映射：一个 teammate 可以有两种合法写法

系统里同一个 teammate 可能以不同格式出现：

- 短名：`backend`
- 完整 ID：`backend@my-team`

这两种写法都是合法的，来自不同的数据源：任务的 `identity.agentName`、任务的 `identity.agentId`、`teamContext.teammates` 里的 `name` 字段。

## 双键映射

`TaskListV2.tsx` 在构建 `teammateActivity` 和 `activeTeammates` 这两个映射时，会同时以 `agentName` 和 `agentId` 作为键写入同一份数据：

```typescript
// 简化逻辑
teammateActivity[bgTask.identity.agentName] = activityText;
teammateActivity[bgTask.identity.agentId] = activityText;   // 备用键
```

颜色映射则先从 `teamContext.teammates` 里按 `teammate.name` 收口，确保整套颜色系统有唯一的「真实来源」。

## 为什么不统一成一种格式

统一格式是理想情况。但现实是：上游数据来自不同链路，强制要求所有地方都用同一种格式意味着要在所有数据入口都做转换，而且转换规则得在整个系统里保持一致。

双键映射是一种务实的解决方案：在消费端（显示层）接受多种输入格式，确保无论上游发来的是短名还是 ID，都能找到对应的颜色和活动状态，不会出现「这个 teammate 没有颜色」或「这个 teammate 的活动找不到」的情况。

## 代价是认知复杂度

引入双键之后，读代码的人需要知道「一个 teammate 可能有两种合法写法」。调试时如果发现颜色或活动状态不对，得考虑两个键哪个命中了、哪个没命中。

这是真实的认知成本。但它替代的是另一种更隐蔽的问题：某些 teammate 偶尔因为格式不匹配而消失在界面上，用户看到空白状态却不知道为什么。两害相权，前者可以通过文档和注释解决，后者是一个随机出现的静默 bug。
