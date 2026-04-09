---
title: "初始化窗口先默认取消elicitation说明总线先兜底再精装"
slug: "07-07-06-elicitation"
date: 2026-04-09
topics: [扩展系统]
summary: "- `client.ts` 在初始化阶段会先给 `ElicitRequestSchema` 挂一个“默认返回 cancel”的 handler，等真正的 elicitation 处理链准备好以后，再由..."
importance: 1
---

# 初始化窗口先默认取消elicitation说明总线先兜底再精装

## 实现链
- `client.ts` 在初始化阶段会先给 `ElicitRequestSchema` 挂一个“默认返回 cancel”的 handler，等真正的 elicitation 处理链准备好以后，再由正式 handler 接管。
- 也就是说，系统先保证 server 不会在初始化窗口里挂死，再去追求完整的人机交互体验。

## 普通做法
- 普通做法可能是完全不处理这类早到请求，或者等 UI 初始化完以后再统一注册 handler。
- 看起来更干净，因为不会出现“默认取消”这种像临时补丁的行为。

## 为什么不用
- Claude Code 没这么冒险，是因为某些 MCP server 在初始化期间就可能发 elicitation。如果那时客户端还没准备好而又不回应，server 可能就一直卡在等待状态。
- 所以这里的默认取消不是偷懒，而是在说：宁可先明确拒绝，也不要先把连接拖死。

## 代价
- 代价是早到的 elicitation 会被保守处理，用户体验不如完整 UI 接手后精致。
- 但在初始化窗口里，这种“先兜底”明显比“先优雅再说”更可靠。
