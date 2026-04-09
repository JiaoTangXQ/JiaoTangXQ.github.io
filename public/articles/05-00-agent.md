---
title: "第五卷导读：子 agent 不是飘散并发，而是先落成任务对象"
slug: "05-00-agent"
date: 2026-04-09
topics: [任务与分派]
summary: "这一卷讲的不是“Claude Code 会不会再开一个能干活的 agent”，而是“它为什么先把这个劳动者变成一个正式任务，再允许它去干活”。 Claude Code 先在 `src/Task.ts`..."
importance: 1.4
---

# 第五卷导读：子 agent 不是飘散并发，而是先落成任务对象

这一卷讲的不是“Claude Code 会不会再开一个能干活的 agent”，而是“它为什么先把这个劳动者变成一个正式任务，再允许它去干活”。

## 实现链

Claude Code 先在 `src/Task.ts` 里规定所有任务共用的骨架：`TaskType`、`TaskStatus`、`TaskStateBase`、`generateTaskId()`、`createTaskStateBase()`。接着，`src/utils/task/framework.ts` 负责把任务登记进 `AppState`，维护更新、通知和回收。到了具体执行层，`src/tasks/LocalAgentTask/LocalAgentTask.tsx` 再把子 agent 补成完整对象，加入 `prompt`、`progress`、`pendingMessages`、`retain`、`evictAfter` 这些运行字段。最后 `src/tools/AgentTool/AgentTool.tsx` 才决定它是同步跑、后台跑，还是被团队模式包进更大的协作关系。

这条链路的重点是先定义“任务是什么”，再定义“任务怎么跑”。小白可以把它理解成：Claude Code 不是先雇一个临时工，再想办法记住他；它是先给这个人建工号、工单、交接簿和退场规则，然后才发活。

## 普通做法

更直觉的做法，是把子 agent 当成一次普通函数调用或者一条异步 Promise。需要时直接 `runAgent()`，结束时把结果塞回主对话；如果要显示进度，就临时挂几个变量；如果要取消，就单独记一个 `AbortController`。

这条路短期很省事，因为一开始几乎不需要任务系统，也不需要统一字段。

## 为什么不用

Claude Code 没这么做，是因为它要解决的不只是“跑起来”，而是“能不能一直被管理”。子 agent 一旦进入产品，就会带来一串现实问题：前台还是后台、能不能切换查看、输出写到哪里、完成后怎么通知、被用户盯住时能不能暂时别回收、被上级 agent 拉起时父子关系怎么处理。

如果不先把劳动翻译成任务对象，这些问题就会散落在 UI、工具层、消息层、清理层各自补丁式处理。短期看像是少写代码，长期看会变成谁都能跑、谁也不好收。

## 代价

这套结构的代价也很真实：任务字段会比“直接开跑”复杂很多，`Task.ts`、任务框架、具体任务实现之间需要长期保持一致；连一个看起来简单的同步子 agent，也得先登记、更新、回收，开发门槛明显更高。

但 Claude Code 显然认为这笔成本值得付，因为它要的是一个能被追踪、能被打断、能被接回、还能被团队制度继续利用的劳动世界，而不是一堆碰巧跑完的后台动作。
