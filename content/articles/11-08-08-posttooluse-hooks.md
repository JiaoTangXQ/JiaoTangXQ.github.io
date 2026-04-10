---
title: "tool_result 到了，PostToolUse hook 还在跑——shouldRenderStatically 怎么判断真正完成？"
slug: "11-08-08-posttooluse-hooks"
date: 2026-04-09
topics: [终端界面]
summary: "Claude Code 的消息行在工具结果到达后并不立即静态化，而是要等 PostToolUse hook 也结清。buildMessageLookups 里的 inProgressHookCounts 和 resolvedHookCounts 提供了这个判断所需的数据。"
importance: 1
---

# tool_result 到了，PostToolUse hook 还在跑——shouldRenderStatically 怎么判断真正完成？

绝大多数 UI 组件会把"结果到了"等同于"结束了"。Claude Code 为什么不这么处理？

## PostToolUse hook 的时序

Claude Code 支持自定义 hook：用户可以配置在特定工具执行完成后触发一段脚本（PostToolUse hook）。这个 hook 的执行是异步的，发生在 API 返回 `tool_result` 之后，但在用户下一次输入之前。

在 hook 执行期间，消息流会收到 `type === 'progress'` 的消息，记录 hook 的运行状态。hook 完成后，会收到 `type === 'hook_attachment'` 的消息，记录 hook 名称和完成状态。

时序上的关键点：`tool_result` 到来的时候，PostToolUse hook 可能还没开始，也可能正在运行。如果界面把 `tool_result` 到来当作"完成"，就会在 hook 还在跑的时候把消息行冻住，后续 hook 产生的 progress 更新无法渲染，显示的状态是错误的。

## buildMessageLookups 里的计数逻辑

`buildMessageLookups` 的第二轮扫描（user 消息、progress、hook attachment）里，有专门针对 hook 的计数：

```typescript
// 遇到 progress 类型且 hook_name 存在
if (msg.type === 'progress' && msg.hookName) {
  const counts = inProgressHookCounts.get(toolUseId) ?? new Map()
  counts.set(msg.hookName, (counts.get(msg.hookName) ?? 0) + 1)
  inProgressHookCounts.set(toolUseId, counts)
}

// 遇到 hook_attachment（hook 已完成）
if (msg.type === 'attachment' && msg.attachment.type === 'hook_attachment') {
  const hookName = msg.attachment.hookName
  if (msg.attachment.hookType === 'PostToolUse') {
    const counts = resolvedHookCounts.get(toolUseId) ?? new Map()
    counts.set(hookName, (counts.get(hookName) ?? 0) + 1)
    resolvedHookCounts.set(toolUseId, counts)
  }
}
```

两张 Map 分别记录"仍在跑"和"已完成"的每个 hook 名称出现次数。

## hasUnresolvedHooksFromLookup

```typescript
function hasUnresolvedHooksFromLookup(
  toolUseId: string,
  hookType: 'PostToolUse',
  lookups: Lookups
): boolean {
  const inProgress = lookups.inProgressHookCounts.get(toolUseId)
  const resolved = lookups.resolvedHookCounts.get(toolUseId)
  if (!inProgress) return false
  for (const [hookName, inProgressCount] of inProgress) {
    const resolvedCount = resolved?.get(hookName) ?? 0
    if (resolvedCount < inProgressCount) return true
  }
  return false
}
```

逻辑：对于每个出现过 progress 记录的 hook 名称，比较"已完成次数"和"进度条数"。如果某个 hook 的已完成次数少于进度条数，说明还有 hook 没跑完。

## shouldRenderStatically 的完整条件

```typescript
function shouldRenderStatically(
  toolUseId: string | undefined,
  lookups: Lookups
): boolean {
  if (!toolUseId) return true
  const isResolved = lookups.resolvedToolUseIDs.has(toolUseId)
  if (!isResolved) return false
  if (hasUnresolvedHooksFromLookup(toolUseId, 'PostToolUse', lookups)) {
    return false
  }
  // sibling 都完成了才静态化
  const siblings = lookups.siblingToolUseIDs.get(toolUseId) ?? []
  return siblings.every(sid => lookups.resolvedToolUseIDs.has(sid))
}
```

三个条件必须全部满足才静态化：主工具结果已到、PostToolUse hook 已结清、所有 sibling 工具调用也已完成。

## 面试指导

这道题是"乐观假设 vs 保守保障"的典型权衡。

**核心争议点**：用户会注意到这几百毫秒的差异吗？答案是：hook 可能需要几秒甚至更长时间（执行外部脚本），这段时间内消息行必须保持动态才能正确显示 hook 的运行进度。如果过早静态化，用户看到的进度消息会无法更新，界面显示和真实状态不符。

**和 React.memo 的关联**：`shouldRenderStatically` 决定的是 `MessageRow` 是否切换到一个更轻量的纯静态渲染路径（不订阅 streaming 更新），而不是 React.memo 的 props 比较。静态化之后这条消息不再参与流式更新的重渲路径，节省了 long session 里的渲染开销。

**追问**：如果 hook 执行失败（抛出异常），`resolvedHookCounts` 还会更新吗？答：取决于 hook 失败的处理方式。如果失败后仍然发出 `hook_attachment` 消息（只是带了 error 状态），那么 resolvedHookCounts 会更新，消息最终会静态化。如果失败后没有发出 attachment，hook 永远不会被标记为 resolved，消息永远不静态化——这是一个真实的边缘情况，需要 timeout 机制兜底。
