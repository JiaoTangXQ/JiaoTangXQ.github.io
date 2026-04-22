---
title: "当你钻进队友线程，底部提示就换成了另一种语气"
slug: "11-04-03-team-lead"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# 当你钻进队友线程，底部提示就换成了另一种语气

驾驶舱最容易犯的错误，是假装不知道用户现在身处哪里。

正常情况下，`PromptInput` 底部的提示服务于当前模式和快捷键状态。但当 `viewSelectionMode` 变成 `'viewing-agent'`、对应的 task 是 `in_process_teammate` 类型时，footer 的逻辑分支就会切换——从「这里是你的输入区」变成「你正站在队友的现场里，esc 可以回到 team lead 层」。

这不是小细节。同一句话在主会话里和在队友线程里意义完全不同。如果底部提示不随层级切换，用户就得靠记忆和推断才能搞清楚自己现在到底对谁说话。

## 两级感知

`ModeIndicator`（在 `PromptInputFooterLeftSide.tsx` 里渲染）同时读了几个状态：`viewingAgentTaskId`、`viewSelectionMode`、当前任务的 `type` 和 `status`。这四条信息合在一起，才能回答「你现在站在哪一层」这个问题。

只有当 task 类型是 `in_process_teammate` 且 `viewSelectionMode` 是 `'viewing-agent'` 时，才会显示 team-lead 语气的提示。其他情况一律走普通路径。

## 为什么层级感知比通用提示更重要

Claudeodo Code 里，一次会话可能同时跑着多个 teammate。用户随时可能跳进任何一个队友的视图里查看进度或发消息。在这种多层协作结构下，底部提示如果还保持通用口吻，就等于界面对层级变化集体失明——用户随时可能忘记自己现在身处主会话还是某个 teammate 的局部现场。

感知层级，并把这种感知翻译成最朴素的文案，是界面诚实的表现之一。

---

从技术债的角度看，这段逻辑的代价是 footer 组件不再是纯 UI：它依赖任务列表和团队上下文，理解协作结构，才能选择该说哪句话。换来的是：用户不会在多层结构里迷失。
