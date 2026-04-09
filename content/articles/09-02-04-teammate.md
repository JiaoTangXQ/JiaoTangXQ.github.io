---
title: "同进程 teammate 做完也不会自动汇报，说明结果可见性也要靠正式通道"
slug: "09-02-04-teammate"
date: 2026-04-09
topics: [多Agent协作]
summary: "哪怕 teammate 就运行在同一个 Node.js 进程里，Claude Code 也不允许它把结果自动泄露给 lead。 `inProcessRunner.ts` 在注释里写得很明确：不会自动把..."
importance: 1
---

# 同进程 teammate 做完也不会自动汇报，说明结果可见性也要靠正式通道

哪怕 teammate 就运行在同一个 Node.js 进程里，Claude Code 也不允许它把结果自动泄露给 lead。

## 实现链

`inProcessRunner.ts` 在注释里写得很明确：不会自动把 teammate 的响应发给 leader，这要靠 Teammate/SendMessage 工具完成。它只会在转入 idle 时发送 idle notification，告诉 leader “我空了” 或 “我失败了”，而不是把完整思考和结果直接灌回去。

这说明“同进程”只代表执行位置相同，不代表可见性自动共享。

## 普通做法

普通做法很容易因为同进程就偷懒，直接把 worker 的输出 append 到 leader 的上下文，反正拿数据很方便。

## 为什么不用

Claude Code 不这么做，是因为可见性和执行位置是两回事。它宁可牺牲一点便利，也要保证 process-based teammate 和 in-process teammate 在沟通制度上尽量一致：都要通过正式通道说话。

## 代价

代价是同进程优势没有被完全榨干，很多“直接共享就行”的捷径被主动放弃了。但这换来了跨后端的一致团队语义。
