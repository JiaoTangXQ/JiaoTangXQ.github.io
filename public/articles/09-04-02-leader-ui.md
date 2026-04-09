---
title: "leader UI 收走的不是权力，而是混乱"
slug: "09-04-02-leader-ui"
date: 2026-04-09
topics: [多Agent协作]
summary: "一眼看上去，leader UI 像是在集中权力；从工程角度看，它其实是在集中打断。 `leaderPermissionBridge.ts` 只暴露两个 setter：一个给工具确认队列，一个给权限上下..."
importance: 1
---

# leader UI 收走的不是权力，而是混乱

一眼看上去，leader UI 像是在集中权力；从工程角度看，它其实是在集中打断。

## 实现链

`leaderPermissionBridge.ts` 只暴露两个 setter：一个给工具确认队列，一个给权限上下文。`inProcessRunner.ts` 在 worker ask 权限时，把标准的 ToolUseConfirm 组件和 worker badge 一起送到 leader UI。这样用户看到的仍然是熟悉的一套确认界面，只是多了“这是哪个 worker 发起的”标识。

## 普通做法

普通做法会给每个 worker 一套自己的权限交互，或者退一步让 worker 自动继承一些权限。

## 为什么不用

Claude Code 认为真正昂贵的不是“谁来点按钮”，而是“用户被多少套界面打断”。lead UI 统一承接这些打断，等于把团队内部复杂性挡在用户前面。

## 代价

代价是 UI 桥必须长期保持稳定，非 React 代码和界面层之间也会因此产生一条显式耦合链。
