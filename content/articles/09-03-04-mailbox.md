---
title: "桥不可用就退回 mailbox，说明快速通道不能成为唯一路径"
slug: "09-03-04-mailbox"
date: 2026-04-09
topics: [多Agent协作]
summary: "同进程 teammate 明明能直接碰到 leader 的 UI 队列，但 Claude Code 仍然保留 mailbox 退路，这非常关键。 `createInProcessCanUseTool(..."
importance: 1
---

# 桥不可用就退回 mailbox，说明快速通道不能成为唯一路径

同进程 teammate 明明能直接碰到 leader 的 UI 队列，但 Claude Code 仍然保留 mailbox 退路，这非常关键。

## 实现链

`createInProcessCanUseTool()` 先尝试通过 `getLeaderToolUseConfirmQueue()` 走 leader 的标准确认弹窗；如果桥不存在，就回退到 mailbox permission request/response 机制。也就是说，leader UI 桥只是快捷通道，不是唯一真理。

## 普通做法

普通做法很容易在同进程场景里直接绑定 UI 桥，然后把这条路写死。因为快，也因为最省代码。

## 为什么不用

Claude Code 不想让快速通道成为唯一入口，因为团队制度需要跨后端一致。tmux teammate 只能靠 mailbox，如果同进程 teammate 拥有一套完全不同的规则，系统就会分裂成两种团队。

所以桥能用就用，不能用就退回最保守、最通用的 mailbox。

## 代价

代价是同进程路径没法追求极致简化。你明明可以直接调函数，却还得维护一套 file-based 回退协议。
