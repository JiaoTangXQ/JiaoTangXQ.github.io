---
title: "虚拟滚动接管后200消息上限只剩兜底，说明 transcript cap 让位给可视化边界"
slug: "11-09-32-200-transcript-cap"
date: 2026-04-09
topics: [终端界面]
summary: "Messages.tsx 里只要 virtualScrollRuntimeGate 打开，MAX_MESSAGES_TO_SHOW_IN_TRANSCRIPT_MODE 就不再主导主路径。真正控制可见..."
importance: 1
---

# 虚拟滚动接管后200消息上限只剩兜底，说明 transcript cap 让位给可视化边界

## 实现链
Messages.tsx 里只要 virtualScrollRuntimeGate 打开，MAX_MESSAGES_TO_SHOW_IN_TRANSCRIPT_MODE 就不再主导主路径。真正控制可见范围的变成视口和虚拟滚动，而不是那条 30/200 的旧上限。

## 普通做法
普通做法会不分场景地继续按固定条数裁剪 transcript。那样 cap 看上去很简单，但会把本来可视化能解决的问题也一起砍掉。

## 为什么不用
这里让 cap 退成兜底，是因为虚拟滚动已经能承担主职责。只要视口和 spacer 还在，固定上限就不该继续当主裁判。

## 代价
代价是要同时维护虚拟化路径和旧 cap 路径，逻辑分叉会更多。好处是当虚拟滚动可用时，用户不再被一个硬上限挡在外面。
