---
title: "性能分析：outputFile + outputOffset 如何实现零拷贝流式尾部追踪"
slug: "05-03-02-outputfile"
date: 2026-04-09
topics: [任务与分派]
importance: 1
---

# 性能分析：outputFile + outputOffset 如何实现零拷贝流式尾部追踪

`TaskStateBase` 里有两个字段：`outputFile: string` 和 `outputOffset: number`。

```typescript
export type TaskStateBase = {
  // ...
  outputFile: string   // 输出文件的绝对路径
  outputOffset: number // 已读取的字节偏移量，初始为 0
  // ...
}
```

这两个字段支撑了一套完整的增量输出追踪系统，让框架能实时读取后台任务的输出，而不需要把整个文件加载进内存。

## 写端：DiskTaskOutput 的写队列

`diskOutput.ts` 里的 `DiskTaskOutput` 类负责异步写入：

```typescript
export class DiskTaskOutput {
  #path: string
  #fileHandle: FileHandle | null = null
  #queue: string[] = []         // 写入队列
  #bytesWritten = 0
  #capped = false               // 是否超出磁盘限额
  #flushPromise: Promise<void> | null = null
  #flushResolve: (() => void) | null = null

  append(content: string): void {
    if (this.#capped) return

    this.#bytesWritten += content.length
    if (this.#bytesWritten > MAX_TASK_OUTPUT_BYTES) {  // 5GB 上限
      this.#capped = true
      this.#queue.push(`\n[output truncated: exceeded ${MAX_TASK_OUTPUT_BYTES_DISPLAY} disk cap]\n`)
    } else {
      this.#queue.push(content)
    }

    if (!this.#flushPromise) {
      this.#flushPromise = new Promise<void>(resolve => {
        this.#flushResolve = resolve
      })
      void track(this.#drain())
    }
  }
}
```

关键设计：`append()` 是同步的，立刻把内容加进队列就返回；实际的磁盘写入在 `#drain()` 里异步完成。这样调用方（Agent 执行循环）不需要等待磁盘 I/O，不会阻塞。

更精妙的是内存管理注释：

```typescript
#writeAllChunks(): Promise<void> {
  // 这段代码非常精确。
  // 你不能在这里加 await！那会导致队列增长时内存膨胀。
  // await 可以加在调用方（#drainAllChunks）里，那里不会让 Buffer[] 保持存活。
  return this.#fileHandle!.appendFile(
    this.#queueToBuffers(),
  )
}

#queueToBuffers(): Buffer {
  // 用 splice 原地清空数组，通知 GC 可以释放内存
  const queue = this.#queue.splice(0, this.#queue.length)
  // ... 拼接成单个 Buffer
}
```

`splice` 清空队列后，原来的字符串数组立刻变成 GC 候选对象。这避免了"写入未完成时所有待写内容都被 Promise 链持有"的内存泄漏问题。

## 安全性：O_NOFOLLOW 防符号链接攻击

```typescript
const O_NOFOLLOW = fsConstants.O_NOFOLLOW ?? 0

// 注释：
// SECURITY: O_NOFOLLOW prevents following symlinks when opening task output files.
// Without this, an attacker in the sandbox could create symlinks in the tasks
// directory pointing to arbitrary files, causing Claude Code on the host to
// write to those files.
```

沙盒环境里的攻击者可以在 tasks 目录里创建软链接，把 `a8kj2m9x.output` 指向任意文件（比如 `/etc/passwd`）。如果不加 `O_NOFOLLOW`，Claude Code 在主机上打开这个路径时，就会跟随符号链接，对攻击者指定的文件进行写入。

`O_NOFOLLOW` 让 `open()` 在路径最后一个组件是符号链接时失败（`ENOENT` 或 `ELOOP`），而不是跟随它。

注意：Windows 没有 `O_NOFOLLOW`，所以用 `fsConstants.O_NOFOLLOW ?? 0` 降级为 0（相当于不设置该标志）。注释里也解释了：沙盒攻击面主要是 Unix 系统，Windows 用字符串 flags `'a'` 替代。

## 读端：增量读取不加载全文件

框架轮询时调用 `getTaskOutputDelta()`：

```typescript
export async function getTaskOutputDelta(
  taskId: string,
  fromOffset: number,
  maxBytes: number = DEFAULT_MAX_READ_BYTES,  // 8MB
): Promise<{ content: string; newOffset: number }> {
  try {
    const result = await readFileRange(
      getTaskOutputPath(taskId),
      fromOffset,     // 从上次读到的字节位置开始
      maxBytes,       // 最多读 8MB
    )
    if (!result) {
      return { content: '', newOffset: fromOffset }
    }
    return {
      content: result.content,
      newOffset: fromOffset + result.bytesRead,  // 更新偏移量
    }
  } catch (e) {
    const code = getErrnoCode(e)
    if (code === 'ENOENT') {
      return { content: '', newOffset: fromOffset }  // 文件不存在，静默返回空
    }
    // ...
  }
}
```

`fromOffset` 是上次读到的字节位置，每次只读从那里到文件末尾的新内容。如果一个 Agent 运行了很长时间、输出了很多内容，框架读取时不需要重新加载前面已经读过的部分。

框架拿到新内容后：

```typescript
// framework.ts
if (taskState.status === 'running') {
  const delta = await getTaskOutputDelta(taskState.id, taskState.outputOffset)
  if (delta.content) {
    updatedTaskOffsets[taskState.id] = delta.newOffset  // 只存新偏移量
  }
}
```

然后用一个单独的 `applyTaskOffsetsAndEvictions()` 把偏移量更新写回 AppState。注意这里只更新偏移量，不更新整个任务状态——这避免了 "async 读文件过程中任务状态可能已经改变" 的 TOCTOU 问题。

## local_agent 的软链接初始化

对于子 Agent 任务，`outputFile` 不是直接写入的文件，而是一个软链接：

```typescript
export function initTaskOutputAsSymlink(
  taskId: string,
  targetPath: string,    // Agent transcript 的实际路径
): Promise<string> {
  return track(
    (async () => {
      try {
        await ensureOutputDir()
        const outputPath = getTaskOutputPath(taskId)
        try {
          await symlink(targetPath, outputPath)
        } catch {
          // 如果已存在，先删后建
          await unlink(outputPath)
          await symlink(targetPath, outputPath)
        }
        return outputPath
      } catch (error) {
        logError(error)
        return initTaskOutput(taskId)  // 软链接失败时降级为直接创建空文件
      }
    })(),
  )
}
```

`a8kj2m9x.output` -> `agent_session_xxx.jsonl`

框架读取 `a8kj2m9x.output` 时，实际上在读 Agent 的实时 transcript。这样，读端完全不需要感知"这个输出是直接写入的还是软链接的"，统一通过 `outputFile` 路径访问即可。

## 面试要点

这是一个经典的**游标模式**（cursor-based pagination）在流式数据场景的应用：

- 写端不断 append，读端维护一个 `offset` 记录读到了哪里
- 每次读取只拿 `[offset, file_end)` 区间的新内容
- 读取完成后更新 `offset`，下次从新位置继续

相比"每次轮询读取全文件"，这个方式在长时间运行的任务上节省大量 I/O。相比"推送模式（写端通知读端）"，这个方式不需要维护回调关系，在任务被后台化后框架仍然可以随时读取。

两者的权衡：拉取模式有轮询延迟（最多 `POLL_INTERVAL_MS = 1000ms`），推送模式实时性更好但系统更复杂。Claude Code 选择了轮询——因为后台任务的输出延迟 1 秒完全可以接受。
