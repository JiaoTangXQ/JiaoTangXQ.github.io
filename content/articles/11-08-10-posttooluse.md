---
title: "PostToolUse 还没收尾就别静态化，说明完成要看整套尾流"
slug: "11-08-10-posttooluse"
date: 2026-04-09
topics: [终端界面]
summary: "这条链和上一页的 hook 计数是同一套东西：`buildMessageLookups` 先统计进度中的 hook，再把已解决的 hook 名字写进 `resolvedHookCounts`，最后由 ..."
importance: 1
---

# PostToolUse 还没收尾就别静态化，说明完成要看整套尾流

## 实现链
这条链和上一页的 hook 计数是同一套东西：`buildMessageLookups` 先统计进度中的 hook，再把已解决的 hook 名字写进 `resolvedHookCounts`，最后由 `hasUnresolvedHooksFromLookup` 决定某个 tool use 的尾流是否真的清空。`shouldRenderStatically` 依赖这个结果，所以消息是否冻结，不是看主结果，而是看整套后续工作有没有走完。

## 普通做法
更普通的做法，是把 `tool_result` 当作终点，结果一到就切静态。

## 为什么不用
PostToolUse 本来就是动作结束后的尾流，可能在主结果之后才陆续跑完。若只盯着主结果，界面会把“已经差不多结束”误当成“真正完成”，后面的收尾信息就会显得像插队。

## 代价
这里的动态状态会多保留一会儿，消息也会因此多几次刷新。代价是更难“立刻收口”，但好处是完成语义和代码里的真实尾流保持一致。
