---
title: "auto-memory 如何从对话尾部提取持久记忆，写入 MEMORY.md 的完整管线"
slug: "170-auto-memory"
date: 2026-04-09
topics: [内存架构, 会话连续性, 上下文管理]
summary: "auto-memory 是 Claude Code 在每次完整 query loop 结束后（无 tool call 的最终回复）触发的一个 forked agent，它扫描当前会话、对比现有 MEMORY.md 内容，只把真正具备长期价值的事实写入项目记忆文件，而不是把整个对话状态都存下来。"
importance: 0.9
---

# auto-memory 如何从对话尾部提取持久记忆，写入 MEMORY.md 的完整管线

面试题形式：**Claude Code 的 auto-memory 在什么时机运行？它和 session memory 有什么本质区别？**

## 触发时机：query loop 完全结束后

auto-memory 通过 `stopHooks.ts` 中的 `handleStopHooks()` 注册——它只在「模型产生最终回复且没有 tool call」时才运行。这不同于 session memory，session memory 是 post-sampling hook，每次 sampling 结束就可能触发；auto-memory 是 stop hook，只在整个 query 周期彻底结束时才跑。

触发还有额外条件：

```ts
function isModelVisibleMessage(message: Message): boolean {
  return message.type === 'user' || message.type === 'assistant'
}

function countModelVisibleMessagesSince(messages, sinceUuid): number {
  // 只统计 user + assistant 消息，排除 attachment、system 等
}
```

如果自上次提取后，model visible messages 不足（token 阈值或消息数阈值），auto-memory 会跳过，避免频繁空跑。

## 提取架构：forked agent + 宽工具权限

与 session memory 提取不同，auto-memory 的 forked agent 被授予了更广泛的工具权限：

```ts
// 允许的工具：
BASH_TOOL_NAME, FILE_READ_TOOL_NAME, FILE_WRITE_TOOL_NAME,
FILE_EDIT_TOOL_NAME, GLOB_TOOL_NAME, GREP_TOOL_NAME, REPL_TOOL_NAME
```

这是因为 auto-memory 的任务更复杂：它需要读取现有的 MEMORY.md（以及 memdir 下的其他记忆文件），理解已有内容，再决定哪些新事实值得追加。

## MEMORY.md 的结构约束

`ENTRYPOINT_NAME = 'MEMORY.md'`，有两个硬性上限：

- 行数上限：`MAX_ENTRYPOINT_LINES = 200`
- 字节上限：`MAX_ENTRYPOINT_BYTES = 25_000`（约 25KB）

超出上限时，`truncateEntrypointContent()` 先按行截断，再按字节截断，并在末尾追加提示说明哪个上限被触发了。这些约束防止 MEMORY.md 无限膨胀导致每次注入都消耗大量 context token。

## 提取内容的过滤策略

auto-memory 的 prompt（`buildExtractAutoOnlyPrompt` 或 `buildExtractCombinedPrompt`）包含了明确的「什么不应该存」指引：

- 临时工作状态（本次会话特有的进度）
- 当前任务细节（已经不再相关的）
- 对话噪音（无法泛化到未来会话的事实）

真正值得存入的是：用户的工作方式偏好、项目架构决策、重复出现的命令模式、已确认的规范。

## 团队记忆扩展

如果开启了 `feature('TEAMMEM')`，auto-memory 还会写入团队共享记忆路径（`teamMemPaths`），让 swarm 中的多个 agent 共享同一套长期知识基础。个人记忆写 `~/.claude/projects/<path>/memory/`，团队记忆写团队特定路径。

## session memory vs auto-memory 的本质区别

| 维度 | session memory | auto-memory |
|------|---------------|-------------|
| 触发时机 | post-sampling hook，每轮结束检查 | stop hook，query 完全结束 |
| 目的 | 记录当前工作状态（短期） | 沉淀跨会话长期知识 |
| 存储位置 | `session_memory.md`（会话级） | `MEMORY.md`（项目级） |
| 工具权限 | 只允许 file_edit memory 路径 | 宽工具权限，可读写整个 memdir |
| 使用方式 | 主要用于 compaction 时重建上下文 | 每次会话开始时注入到 context |

## 面试要点

**Q：auto-memory 在 remote mode 下能用吗？**

不能。与 session memory 一样，`getIsRemoteMode()` 为 true 时，auto-memory 不初始化，不注册 stop hook。

**Q：如果 MEMORY.md 超过了 200 行，会发生什么？**

`truncateEntrypointContent()` 截断到 200 行，同时记录 `wasLineTruncated: true`。截断后的内容附上警告行，让模型（和用户）知道内容被截断了。这个截断逻辑同时被 `buildMemoryPrompt()` 和 `claudemd.getMemoryFiles()` 共用，保证一致性。

**Q：为什么 auto-memory 使用 closure-scoped state 而非 module-level state？**

注释里明确说明：「State is closure-scoped inside `initExtractMemories()` rather than module-level, following the same pattern as `confidenceRating.ts`. Tests call `initExtractMemories()` in `beforeEach` to get a fresh closure.」这让每个测试用例都有隔离的状态，不会互相污染。
