---
title: "为什么权限请求要落盘到 pending/resolved 目录，而不是只存内存？"
slug: "09-04-03-pendingresolved"
date: 2026-04-09
topics: [多Agent协作]
summary: "permissionSync.ts 把每个权限请求写到 ~/.claude/teams/{team}/permissions/pending/ 目录，审批后移到 resolved/。这不是过度设计——它在回答一个具体问题：跨进程的 agent 怎么和 leader 协调权限，以及如何保证权限审批的可追溯性。"
importance: 1
---

# 为什么权限请求要落盘到 pending/resolved 目录，而不是只存内存？

`permissionSync.ts` 的目录结构：

```
~/.claude/teams/{teamName}/permissions/
  pending/
    perm-1703123456789-abc1234.json
    perm-1703123456800-xyz5678.json
  resolved/
    perm-1703123456000-old1234.json
```

每个 `pending/` 里的文件代表一个等待 leader 审批的权限请求，每个 `resolved/` 里的文件代表已经处理完的请求。

问题来了：in-process teammate 和 leader 在同一进程，直接内存通信就够了。为什么还要写文件？

## 为跨进程 agent 设计的通信层

答案首先是：这个机制**主要服务于 tmux pane teammate**，不是 in-process teammate 的主要路径。

Tmux pane teammate 是独立的 Claude Code 进程。它需要请求权限时，无法直接访问 leader 进程的内存，只能通过进程间通信。文件系统是这两个进程唯一共享的地址空间。

`permissionSync.ts` 的设计：
1. Worker 把请求写进 `pending/` 目录（这个目录两个进程都能访问）
2. Leader 轮询 `pending/` 目录，发现新请求
3. 用户通过 leader UI 批准或拒绝
4. Leader 把请求从 `pending/` 移到 `resolved/`，写入决定结果
5. Worker 轮询 `resolved/` 目录，发现自己的请求被处理了，继续执行

对 in-process teammate 来说，路径 A（leader UI 桥）更快；但如果桥不可用，它也会走这条路径，和 tmux teammate 保持一致的协议。

## 请求对象的完整结构

每个请求文件包含：

```typescript
type SwarmPermissionRequest = {
  id: string              // "perm-1703123456789-abc1234"
  workerId: string        // "researcher@my-team"
  workerName: string      // "researcher"
  workerColor?: string    // "blue"
  teamName: string        // "my-team"
  toolName: string        // "Bash"
  toolUseId: string       // 原始 tool_use ID
  description: string     // 人可读的描述
  input: Record<string, unknown>  // 工具输入参数
  permissionSuggestions: unknown[]  // AI 建议的规则
  status: 'pending' | 'approved' | 'rejected'
  resolvedBy?: 'worker' | 'leader'
  resolvedAt?: number     // Unix timestamp
  feedback?: string       // 拒绝时的原因
  updatedInput?: Record<string, unknown>  // leader 修改了输入
  permissionUpdates?: PermissionUpdate[]  // 总是允许的规则
  createdAt: number
}
```

这比一个"批准/拒绝"的布尔值多了很多。为什么需要这些额外字段？

**`workerName` + `workerColor`**：在 leader UI 里显示是哪个 agent 发起的请求，让用户有上下文判断是否合理。

**`description`**：人可读的请求说明，比原始工具输入参数更容易理解。

**`permissionSuggestions`**：AI 基于上下文建议的权限规则。如果用户选择"总是允许这类操作"，这个字段提供了建议的规则模板。

**`feedback`**：拒绝时可以附上原因，让 worker 知道为什么被拒，可以调整后重新请求。

**`updatedInput`**：leader 可以修改 worker 请求的工具输入。比如 worker 要 `rm -rf /tmp/project`，leader 觉得路径不对，可以改成 `rm -rf /tmp/project-backup` 再批准。

**`permissionUpdates`**：如果用户选择"总是允许这类操作"，记录下具体的规则，之后同类请求不需要再次确认。

## 文件锁保证并发安全

`pending/` 目录可能被多个 worker 同时写入：

```typescript
// 创建一个目录级别的锁文件
const lockFilePath = join(lockDir, '.lock')
await writeFile(lockFilePath, '', 'utf-8')

let release: (() => Promise<void>) | undefined
try {
  release = await lockfile.lock(lockFilePath)
  // 在锁保护下写入请求文件
  await writeFile(pendingPath, jsonStringify(request, null, 2), 'utf-8')
} finally {
  if (release) await release()
}
```

注意：这里用的是**目录级锁**，不是文件级锁。因为 `pending/` 目录里有很多文件，需要保证"列出目录 + 检查是否有同名文件 + 写入"这整个操作是原子的。

如果用文件级锁，两个 worker 可能同时生成相同 ID 的请求文件（虽然用了随机部分降低了概率），写入时相互覆盖。目录级锁避免了这个问题。

## Resolved 目录的清理机制

`cleanupOldResolutions()` 定期清理过期的 resolved 文件：

```typescript
export async function cleanupOldResolutions(
  teamName?: string,
  maxAgeMs = 3600000,  // 默认 1 小时
): Promise<number> {
  // 遍历 resolved/ 目录，删除超过 maxAgeMs 的文件
}
```

没有清理机制，`resolved/` 目录会随着时间积累大量历史文件，占用磁盘空间，也让轮询变慢（遍历更多文件才能找到目标请求）。

1 小时的默认清理时间是合理的：大多数权限请求在被处理后几秒到几分钟内就会被 worker 读取并处理完，超过 1 小时仍在 `resolved/` 的文件基本可以认为 worker 已经不再需要了。

## 面试怎么答

如果面试题是"跨进程的 agent 如何协调权限审批"：

**核心答案**：文件系统是跨进程通信的最低共同层。用一个共享的目录作为"消息盒子"，写文件 = 发消息，读文件 = 收消息，文件锁 = 互斥写入保证。

**进阶思路**：pending/resolved 两阶段状态比单一状态文件更清晰——pending 代表"等待处理"，resolved 代表"已有决定"，两个状态对应两个目录，无需读取文件内容就能判断当前处于哪个阶段（直接看文件在哪个目录）。

**可追溯性设计**：把请求写成完整记录（包括工具名、输入、处理者、时间），而不是只记录"批准还是拒绝"，是安全系统设计的基本原则。事后审计、权限争议处理、安全事件复盘，都依赖这份记录的完整性。

**一个容易忽略的点**：`updatedInput` 字段允许 leader 修改 worker 请求的工具输入。这让权限确认不是简单的 yes/no，而是一个可以协商的对话——leader 可以说"我批准你执行这个操作，但参数改成这个"。这是比简单审批更精细的控制粒度。
