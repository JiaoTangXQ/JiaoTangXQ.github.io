---
title: "第十三卷回收索引：任务世界里 pendingMessages 先排队再过轮次边界"
slug: "116-pendingmessages"
date: 2026-04-09
topics: [参考]
summary: "这页具体回收的判断是“任务世界—pendingMessages先排队再过轮次边界”。 这页真正回收的是 `Task.ts`、`tasks/LocalAgentTask/LocalAgentTask.t..."
importance: 0.9
---

# 第十三卷回收索引：任务世界里 pendingMessages 先排队再过轮次边界

## 实现链

这页具体回收的判断是“任务世界—pendingMessages先排队再过轮次边界”。
这页真正回收的是 `Task.ts`、`tasks/LocalAgentTask/LocalAgentTask.tsx`、`tools/AgentTool/*` 和状态存储里那套“先把劳动写成对象”的实现。Claude Code 不把后台能力当成一条飞出去的异步调用，而是先落成任务对象，再记录状态、输出、`pendingMessages`、`backgroundSignal`、`retain`、`evictAfter` 这些事实，好让前台、后台、面板和主会话都能继续认出它是同一份劳动。

## 普通做法

更常见的做法，是起一个后台 Promise、子进程或 worker，结束时返回一段字符串，界面上最多给它一个 spinner。这样实现简单，后台能力也能很快跑起来。

## 为什么不用

Claude Code 没这么做，因为它不是只想“让后台跑”，而是想让这份后台劳动能被接手、能被观察、能被重新挂回主会话，还能在前后台切换时保持身份不散。如果没有任务对象和那一串状态字段，系统就只能知道“有东西在跑”，却不知道“跑的是哪一份工作、谁可以继续接手、界面该怎么善后”。

## 代价

这种做法更适合长期工作台，因为它把劳动做成了可治理对象。代价是任务对象明显更重，很多字段看起来像一份小型操作系统元数据；如果只想快速起后台动作，这套设计会比直接异步执行更笨重。

## 继续下钻

- `05-08-02` 把 `pendingMessages` 写成先排队、再过轮次边界，这会在 `13-03-02` 里回收到“小连接件少失控一次、少重造一层”，说明系统先把后台消息放进可管理的等待区，再决定它什么时候正式跨进这一轮。
