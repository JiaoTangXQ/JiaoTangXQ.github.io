---
title: "worker badge 和统一弹窗让团队秩序对人可见"
slug: "09-06-02-worker-badge"
date: 2026-04-09
topics: [多Agent协作]
summary: "制度如果只存在代码里，用户感知不到。Claude Code 会把 worker 身份显式做进 lead 的权限弹窗。 `createInProcessCanUseTool()` 在把请求塞进 lead..."
importance: 1
---

# worker badge 和统一弹窗让团队秩序对人可见

制度如果只存在代码里，用户感知不到。Claude Code 会把 worker 身份显式做进 lead 的权限弹窗。

## 实现链

`createInProcessCanUseTool()` 在把请求塞进 leader 的 ToolUseConfirm 队列时，会附带 `workerBadge`，包含成员名字和颜色。这样用户在同一套确认 UI 中，能看到“是谁要做这件事”。

## 普通做法

普通做法很容易只复用一套权限弹窗，却不标成员来源。界面统一了，但组织信息丢了。

## 为什么不用

Claude Code 不愿意为了复用 UI 抹掉组织差异。统一弹窗是为了少打断，badge 是为了不丢责任归属，两者缺一不可。

## 代价

代价是通用确认组件要认识团队上下文，纯粹性变差一些。但用户理解会好很多。
