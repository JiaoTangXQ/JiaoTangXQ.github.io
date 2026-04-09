---
title: "brief 模式也保留 system 和 error，说明压缩不能把反馈一起删掉"
slug: "11-07-06-briefsystemerror"
date: 2026-04-09
topics: [终端界面]
summary: "`filterForBriefTool()` 在 brief-only 模式下会只留 Brief 相关的 `tool_use` / `tool_result` / 真实用户输入，但 `system` ..."
importance: 1
---

# brief 模式也保留 system 和 error，说明压缩不能把反馈一起删掉

## 实现链
`filterForBriefTool()` 在 brief-only 模式下会只留 Brief 相关的 `tool_use` / `tool_result` / 真实用户输入，但 `system` 消息和 API error 还会留下来；`dropTextInBriefTurns()` 则是在完整 transcript 里，专门去掉调用 Brief 那一轮里重复的助手正文。它们的共同点是先问“这条信息是不是还得对人负责”，再决定要不要删。

## 普通做法
普通列表如果做压缩，常常会顺手把“看起来不重要”的反馈也一起吞掉，最后只剩正文。

## 为什么不用
Claude Code 的 brief 不是静音模式。用户需要知道系统消息、报错和真实输入，不然就看不出这轮是成功、失败，还是只是模型少说了一句。压缩可以拿掉重复内容，但不能把解释现场的那部分也拿掉。

## 代价
代价是 brief 过滤更严格，也更容易出现“空白一轮”的感觉。但这不是 UI 没做事，而是它故意不替模型补台。
