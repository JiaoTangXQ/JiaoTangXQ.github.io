---
title: "brief turn 文本要留在真正解释制度的位置，说明压缩不是把说明一起删掉"
slug: "11-07-16-brief-turn"
date: 2026-04-09
topics: [终端界面]
summary: "`brief` 模式不是把一整轮都压成空白, 而是有选择地删掉重复文本。Claude Code 真正想删的是“已经被 Brief 工具替代掉的助手铺陈”, 不是把这轮为什么会被压缩、系统到底做了什么也..."
importance: 1
---

# brief turn 文本要留在真正解释制度的位置，说明压缩不是把说明一起删掉

`brief` 模式不是把一整轮都压成空白, 而是有选择地删掉重复文本。Claude Code 真正想删的是“已经被 Brief 工具替代掉的助手铺陈”, 不是把这轮为什么会被压缩、系统到底做了什么也一起抹掉。

## 实现链

这条线落在 `Messages.tsx` 里两套过滤器上。`filterForBriefTool()` 在 brief-only 模式下只保留 Brief 相关 `tool_use`、对应的 `tool_result`、真实用户输入, 以及必要的系统反馈; `dropTextInBriefTurns()` 则在普通 transcript 里只删那些“这一轮已经调用了 Brief 工具”的助手文本。代码里还明确保留 system message, 只特判丢掉 `api_metrics` 这种调试噪声。所以真正承担“解释制度”的文本, 会留在系统提示、工具结果或必要的用户输入位置上, 不是被一刀切删光。

## 普通做法

更简单的做法是要么整轮都保留, 让 brief 形同虚设; 要么整轮都砍掉, 用户只看到一个空壳结果。

## 为什么不用

Claude Code 不选这两种极端, 因为 brief 的目标是压冗余, 不是压事实。要是把真正解释这轮制度变化的内容也删掉, 用户只会看到“屏幕突然少了很多字”, 却不知道为什么少、少掉的是什么。它宁可多写几条过滤规则, 也要保住必要说明还留在正确位置。

## 代价

代价是 brief 逻辑不再是一个简单的布尔开关, 而是要理解 turn 边界、tool name、meta/user/system 的区别。阅读源码时, 你得同时看 `filterForBriefTool()` 和 `dropTextInBriefTurns()` 才知道某段文本为什么消失、另一段为什么保留。
