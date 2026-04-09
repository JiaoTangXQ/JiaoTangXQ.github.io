---
title: "sticky prompt 只取首段并限长，说明悬浮提醒只负责找回入口"
slug: "11-09-08-sticky-prompt"
date: 2026-04-09
topics: [终端界面]
summary: "stickyPromptText 会先走 stripSystemReminders，再只保留首段，并用 STICKY_TEXT_CAP 限住长度。StickyTracker 拿到的是 breadcru..."
importance: 1
---

# sticky prompt 只取首段并限长，说明悬浮提醒只负责找回入口

## 实现链
stickyPromptText 会先走 stripSystemReminders，再只保留首段，并用 STICKY_TEXT_CAP 限住长度。StickyTracker 拿到的是 breadcrumb，不是原 prompt 的完整正文。

## 普通做法
普通实现通常会把整个 prompt 直接塞进 header，或者只做一个粗暴截断。前者会让顶部浮层膨胀，后者又常把真正可辨认的开头切没了。

## 为什么不用
这里的悬浮提醒只需要帮人认路，不需要复制内容。首段加限长能让 header 足够短，也能避开 system reminder 之类不属于用户原话的东西。

## 代价
代价是 header 里会丢掉后续段落和更长的语境。好处是 sticky prompt 不会变成第二份正文，界面也不会因为顶部过长而失去稳定性。
