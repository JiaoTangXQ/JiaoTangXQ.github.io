---
title: "未决 PostToolUse hooks 还在时先别静态化，说明表面完成不等于真正收尾"
slug: "11-08-08-posttooluse-hooks"
date: 2026-04-09
topics: [终端界面]
summary: "`buildMessageLookups` 会从 `progress` 消息里累计 `inProgressHookCounts`，再从 hook attachment 里按 `hookName` 统计..."
importance: 1
---

# 未决 PostToolUse hooks 还在时先别静态化，说明表面完成不等于真正收尾

## 实现链
`buildMessageLookups` 会从 `progress` 消息里累计 `inProgressHookCounts`，再从 hook attachment 里按 `hookName` 统计 `resolvedHookCounts`。`hasUnresolvedHooksFromLookup(toolUseID, 'PostToolUse', lookups)` 只是拿这两组数做比较。`shouldRenderStatically` 依赖这个结果，不会在 post hook 还没结清时把消息冻住，所以 `HookProgressMessage` 还能继续显示“running”或已完成的 hook 计数。

## 普通做法
更普通的做法，是一看到 `tool_result` 就把这条消息当成结束了，直接切到静态渲染。

## 为什么不用
在这个运行时里，工具主结果和后续 hook 不是同一时刻结束的。`tool_result` 可能已经到了，但 `PostToolUse` 还在跑，甚至还会继续吐 progress；如果过早静态化，界面会把“快结束”误写成“已经结束”。

## 代价
消息行会多保持一会儿动态状态，还要接受 hook 进度带来的额外重渲染。代价是更晚收口，但好处是收口之前不会撒谎。
