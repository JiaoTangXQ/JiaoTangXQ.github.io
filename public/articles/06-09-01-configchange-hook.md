---
title: “ConfigChange hook 返回 exit code 2 能永久阻断 settings 变化生效？”
slug: "06-09-01-configchange-hook"
date: 2026-04-09
topics: [治理与权限]
summary: “changeDetector 在调用 fanOut 之前先执行 ConfigChange hook，如果 hook 返回 exit code 2，这次 settings 变化永久不生效。这个机制的应用场景和安全边界是什么？”
importance: 1
---

# ConfigChange hook 返回 exit code 2 能永久阻断 settings 变化生效？

`changeDetector.ts` 里有一个在文档里几乎没有提及的机制：每次 settings 文件变化，系统在应用变化前先执行 ConfigChange hook，如果 hook 拒绝了，这次变化**永远不会生效**。

## handleChange 的完整流程

```typescript
function handleChange(path: string): void {
  const source = getSourceForPath(path)
  if (!source) return

  // 检查是否是内部写入
  if (consumeInternalWrite(path, INTERNAL_WRITE_WINDOW_MS)) {
    return
  }

  logForDebugging(`Detected change to ${path}`)

  // 先执行 ConfigChange hook，再决定是否 fanOut
  void executeConfigChangeHooks(
    settingSourceToConfigChangeSource(source),
    path,
  ).then(results => {
    if (hasBlockingResult(results)) {
      logForDebugging(`ConfigChange hook blocked change to ${path}`)
      return  // 不调用 fanOut，变化被永久忽略
    }
    fanOut(source)  // 只有 hook 通过时才传播变化
  })
}
```

`hasBlockingResult` 检查 hook 的返回结果：如果任何 hook 返回了”阻断”决定（exit code 2 或 `decision: 'block'`），整个 ConfigChange 序列被标记为阻断，`fanOut` 不会被调用。

## 被阻断的变化不会重试

关键点：这里的”永久不生效”是真的永久。系统没有重试机制，没有变化队列，没有”hook 解除后重新应用”的逻辑。

如果 hook 今天阻断了这次变化，明天 hook 被删除，之前那次被阻断的变化已经消失。唯一让新 settings 生效的方式是：重新保存文件，触发新的 `change` 事件，走一遍新的 hook 流程。

## ConfigChange hook 的典型应用场景

**场景一：合规审计日志**

企业环境里，所有 settings 变化可能需要记录到审计日志。ConfigChange hook 可以在每次变化时：
1. 记录谁（操作系统用户）在什么时间修改了什么文件
2. 如果文件被未授权用户修改，返回 exit code 2 阻断变化

**场景二：防止 settings 被恶意修改**

攻击场景：恶意 PR 里包含修改 `.claude.json` 的代码，执行后会在项目 settings 里注入危险的 allow 规则。ConfigChange hook 可以：
1. 检查修改内容是否合法（比如用 git diff 检查谁修改了这个文件）
2. 如果发现注入了 `Bash(*)` 这样的宽松规则，阻断变化并告警

**场景三：A/B 测试和灰度发布**

远程配置系统可以通过 ConfigChange hook 控制某些 settings 变化是否生效，实现功能的渐进发布。

## hasBlockingResult 的判断逻辑

```typescript
// hooks.ts
export function hasBlockingResult(results: AggregatedHookResult[]): boolean {
  return results.some(result =>
    result.type === 'block' ||
    (result.type === 'exitCode' && result.exitCode === 2)
  )
}
```

两种阻断方式：
1. **`decision: 'block'`**：hook 通过 JSON stdout 返回阻断决定
2. **exit code 2**：hook 进程以 exit code 2 退出

exit code 0 = 成功允许，exit code 1 = hook 执行失败（但不一定阻断），exit code 2 = 显式阻断。

## 删除文件也走 ConfigChange hook

注意：不只是文件变化，文件删除也要过 hook：

```typescript
function handleDelete(path: string): void {
  // 延迟处理删除（1700ms grace period）
  const timer = setTimeout(
    (p, src) => {
      pendingDeletions.delete(p)
      void executeConfigChangeHooks(
        settingSourceToConfigChangeSource(src),
        p,
      ).then(results => {
        if (hasBlockingResult(results)) {
          logForDebugging(`ConfigChange hook blocked deletion of ${p}`)
          return  // 阻断删除事件
        }
        fanOut(src)
      })
    },
    DELETION_GRACE_MS,
    path, source,
  )
}
```

settings 文件被删除，等价于”恢复到默认配置”——这也是一种配置变化。如果删除事件被 hook 阻断，系统会继续使用旧的 settings（虽然文件已经不在磁盘上了）。

这是一个有趣的状态：内存里的权限状态和磁盘上的文件内容不一致，但这是有意为之——hook 认为这次删除不该生效。

## 这道题考什么

**ConfigChange hook 的阻断是永久的**：这一点很容易被误解成”hook 放行后变化才生效，但下次还会问”。正确理解是：每次文件变化事件只走一次 hook，被阻断了就被阻断了，没有重试。

**阻断 vs 失败**：exit code 1 是 hook 执行失败（比如脚本报错），不等于阻断。阻断需要 exit code 2 或显式 `decision: 'block'`。这个区分很重要，否则 hook 里的 bug（非零退出码）可能意外地永久阻断所有 settings 变化。

**内存状态和磁盘不一致**：删除被阻断的场景下，文件消失但内存状态保持。这个不一致是设计意图，但需要理解其含义——重启进程后会怎样？（重新读磁盘，没有文件，内存会恢复默认状态。）
