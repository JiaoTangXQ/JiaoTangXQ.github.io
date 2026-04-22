---
title: "第十三卷回收索引：前四卷里的 `stop hooks` 阻塞也有资格改写主循环去向"
slug: "250-stop-hooks"
date: 2026-04-09
topics: [参考]
importance: 0.9
---

# 第十三卷回收索引：前四卷里的 `stop hooks` 阻塞也有资格改写主循环去向

## 实现链
`stop hooks` 只在拿到有效 assistant 响应后才跑；如果最后一条消息其实是 API error，系统会直接跳过 hooks。真有 blocking errors 时，它会把错误追加进 `messages`，再把 `transition.reason` 设成 `stop_hook_blocking` 继续下一轮。

## 普通做法
更普通的做法，是 hook 阻塞就整轮失败退出，或者相反，不管什么情况都强行跑 hook。

## 为什么不用
Claude Code 不这么做，因为有些阻塞不是尾声，而是在给下一轮补前提；制度层失败不只是日志，它本身就能改写去向。

## 代价
代价是 hook 不再是独立前后置插件，而要和主循环状态机互相理解，调试也会更绕。
