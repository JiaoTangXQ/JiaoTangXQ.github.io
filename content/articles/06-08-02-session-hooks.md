---
title: "session hooks和多后端执行说明它是总线"
slug: "06-08-02-session-hooks"
date: 2026-04-09
topics: [治理与权限]
summary: "这一页重点看“session hooks 和多后端执行说明它是总线”。对应源码主要是 `src/utils/hooks/sessionHooks.ts`、`src/utils/hooks/hookEv..."
importance: 1
---

# session hooks和多后端执行说明它是总线

## 实现链

这一页重点看“session hooks 和多后端执行说明它是总线”。对应源码主要是 `src/utils/hooks/sessionHooks.ts`、`src/utils/hooks/hookEvents.ts`、`src/utils/hooks/execPromptHook.ts`、`src/utils/hooks/execAgentHook.ts`、`src/utils/hooks/execHttpHook.ts`。
这一章真正落在 `hooksConfigSnapshot.ts`、`sessionHooks.ts`、`hookEvents.ts` 和多后端执行器上。Claude Code 先冻结一版 hooks 快照，再按事件总线的方式把 session hooks、命令 hooks、HTTP hooks、agent hooks 统一挂到同一套运行机制里。

## 普通做法

更直觉的做法，是每次事件发生时直接读取最新 hooks 配置，然后同步执行脚本或回调。这样实现简单，也最像传统插件回调。

## 为什么不用

Claude Code 没这么做，因为 hooks 在这里不只是回调，而是会改写运行时行为的插桩总线。要是配置一边变、事件一边跑，系统就可能在同一轮里执行到两套不同 hooks；要是后端各自为战，又会把总线打散成一堆零件。

## 代价

总线化和快照化让 hooks 更稳，也更适合多来源后端。代价是抽象层次更深，理解它要同时看快照、事件、执行器和 session 作用域。
