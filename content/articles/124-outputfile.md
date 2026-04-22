---
title: "outputFile：把后台过程留成外部痕迹，为什么这是可恢复系统的必要条件"
slug: "124-outputfile"
date: 2026-04-09
topics: [任务系统, 持久化, 可恢复性]
importance: 0.9
---

# 面试题：outputFile 在任务系统里解决了什么具体问题？

## 从一个故障场景开始

你在 Claude Code 里启动了一个长时间运行的子 agent 任务——比如"分析整个代码库里的安全漏洞"。

这个任务需要 20 分钟。在第 12 分钟时，你的笔记本睡眠了。

15 分钟后你打开笔记本，Claude Code 进程已经被系统关掉了。

**问题：任务已经完成的 12 分钟的进度，保存了吗？**

如果任务输出只在内存里，答案是：没有。

如果任务输出写到了 `outputFile`，答案是：大部分保存了，Claude Code 重启后可以从 `outputOffset` 续读。

## outputFile 的具体实现

在 `src/Task.ts` 里：

```typescript
export type TaskStateBase = {
  // ...
  outputFile: string    // 输出文件的路径
  outputOffset: number  // 已读到的字节偏移量
  // ...
}
```

输出文件路径由 `getTaskOutputPath(id)` 生成，这个函数在 `src/utils/task/diskOutput.ts` 里：

```typescript
// src/tasks/LocalAgentTask/LocalAgentTask.tsx 里的引用：
import { evictTaskOutput, getTaskOutputPath, initTaskOutputAsSymlink } from '../../utils/task/diskOutput.js'
```

`initTaskOutputAsSymlink`——注意这个函数名。任务的输出文件是通过**符号链接**初始化的，而不是直接创建文件。

为什么用符号链接？因为 agent 的实际输出已经有一个自然的存储位置（agent 的 transcript 路径），用符号链接可以把任务的 `outputFile` 指向这个已有位置，避免数据重复。

## 外部化的三个好处

**好处一：跨进程可见**

进程 A 写入 `outputFile`，进程 B 可以读取。这是最基本的外部化好处。

在 Claude Code 里，这意味着：主会话可以实时读取子 agent 的输出进度；进程重启后可以恢复任务状态；外部工具（比如调试器）可以查看任务输出。

**好处二：增量读取**

`outputOffset` 记录了"已经读取到哪个字节位置"。这让消费者可以只读取新增的内容，而不是每次都从头读。

对一个输出很多内容的长时间任务，这个优化很重要：如果每次都从头读取再做差分对比，随着输出增长，开销会越来越大。记录 offset 后，每次读取是 O(新增内容)，而不是 O(总内容)。

**好处三：独立于任务生命周期**

任务可以失败、被杀掉、被驱逐出 AppState，但 `outputFile` 里的内容仍然在。

这对调试非常有价值：任务崩溃后，你仍然可以查看崩溃前的所有输出，而不是只看到一个错误信息。

## evictTaskOutput 的设计考量

`evictTaskOutput` 函数也值得注意。任务进入终态（completed/failed/killed）后，它的输出文件可能需要被清理。

但不是立即清理——`PANEL_GRACE_MS`（在 `src/utils/task/framework.ts` 里定义）表示任务完成后会有一段"宽限期"，在此期间输出文件仍然保留，让 UI 有时间展示最终结果，让用户有时间查看。

宽限期结束后，`evictTaskOutput` 才真正清理磁盘上的文件。

这个设计体现了"体面退场"的原则：任务结束不是立即消失，而是给系统和用户一个有序的收尾时间。

## 和 session 存储的关系

`getAgentTranscriptPath`（在 `src/utils/sessionStorage.ts` 里）返回 agent 的完整会话记录路径。

`outputFile`（通过 `initTaskOutputAsSymlink`）指向这个路径的某个子集或同一位置。

这意味着任务的"输出"和 agent 的"会话记录"在文件系统层面是关联的。任务可以被驱逐（从 AppState 里删除），但 agent 的 transcript 可以独立保留（用于历史查看和会话恢复）。

这种关联让两套存储（任务状态 vs 会话记录）能协同工作，而不是各自孤立。

## 面试要点

1. **外部化是可恢复性的前提**：内存里的输出不能跨进程，文件系统上的输出可以。这不是优化，是长期工作台的必要条件。
2. **outputOffset 让增量读取成为可能**：避免每次从头读整个输出文件，O(新增内容) 而不是 O(总内容)。
3. **符号链接避免数据重复**：outputFile 通过符号链接指向 agent transcript，任务状态和会话记录共享底层数据。
4. **宽限期是体面退场的实现**：任务完成后不立即清理，给 UI 和用户有序收尾的时间。
