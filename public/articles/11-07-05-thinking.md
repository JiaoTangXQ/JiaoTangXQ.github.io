---
title: "thinking 停止后还再留三十秒，说明消息编排也在照顾迟到的眼睛"
slug: "11-07-05-thinking"
date: 2026-04-09
topics: [终端界面]
summary: "流式 thinking 不是一停就立刻消失。Claude Code 故意给它一个短暂的缓冲窗口, 让刚把视线移过来的人还能看见“刚才模型在想什么”。这说明消息编排关心的不只是数据是否结束, 也关心人有..."
importance: 1
---

# thinking 停止后还再留三十秒，说明消息编排也在照顾迟到的眼睛

流式 thinking 不是一停就立刻消失。Claude Code 故意给它一个短暂的缓冲窗口, 让刚把视线移过来的人还能看见“刚才模型在想什么”。这说明消息编排关心的不只是数据是否结束, 也关心人有没有来得及看到。

## 实现链

`Messages.tsx` 里专门有一段 `isStreamingThinkingVisible` 逻辑: 如果 `streamingThinking.isStreaming` 还在, 当然继续显示; 如果已经停了, 但 `streamingEndedAt` 距离现在还不到 30000 毫秒, 也继续显示。随后 `lastThinkingBlockId` 会配合 `hidePastThinking` 去隐藏更早的 thinking, 保留“当前这轮还值得看见的那一段”。也就是说, 这不是随机的延迟消失, 而是代码里明写的 30 秒可视期。

## 普通做法

更普通的做法要么是 thinking 一结束就瞬间撤掉, 要么干脆全部永久留着, 让每一轮思考都一直占屏。

## 为什么不用

Claude Code 没选前者, 因为那会让 thinking 像闪一下就没的临时噪声, 用户稍微晚看一眼就错过了; 也没选后者, 因为长会话里 thinking 会很快把屏幕淹掉。30 秒是个折中: 它承认 thinking 刚结束时仍然有阅读价值, 但这份价值不是无限期的。

## 代价

代价是界面里会存在一种“技术上已经停止, 视觉上还暂留”的状态。实现上也要额外维护 `streamingEndedAt` 这种时间语义, 让消息区不再只是静态渲染当前状态, 而是开始管理人的观看节奏。
