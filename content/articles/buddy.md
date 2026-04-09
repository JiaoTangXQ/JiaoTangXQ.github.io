---
title: "/buddy 会在输入中变彩虹，说明体验层先借现有操纵面发声"
slug: "buddy"
date: 2026-04-09
topics: [终端界面]
summary: "`useBuddyNotification.tsx` 先在启动时给出彩虹 `/buddy`，`PromptInput.tsx` 再用 `findBuddyTriggerPositions()` 扫描输..."
importance: 1
---

# /buddy 会在输入中变彩虹，说明体验层先借现有操纵面发声

## 实现链

`useBuddyNotification.tsx` 先在启动时给出彩虹 `/buddy`，`PromptInput.tsx` 再用 `findBuddyTriggerPositions()` 扫描输入，把用户真的键入的 `/buddy` 也染成彩虹。体验层先借现有输入面说话，而不是另开一扇门。

## 普通做法

普通做法常常是新增一个独立按钮、面板或命令入口，告诉用户“这里是陪伴层的专用通道”。那会更直观，但也更容易把界面切成两套语言。

## 为什么不用

Claude Code 选择复用现有输入面，是因为 buddy 要被看见，但不该逼用户学习第二套操作习惯。它沿着主输入区进入现场，而不是另起炉灶去抢版面。

## 代价

代价是实现得更克制，也更依赖主输入区已有的排版和高亮机制。好处是 buddy 被放大成体验，而不是被做成一个独立世界。
