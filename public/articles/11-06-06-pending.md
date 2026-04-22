---
title: "面试题：pending 任务的排序逻辑是什么？blockedBy 是如何影响可见性优先级的？"
slug: "11-06-06-pending"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# 面试题：pending 任务的排序逻辑是什么？blockedBy 是如何影响可见性优先级的？

这道题要求你理解"依赖感知排序"——不是把所有任务平铺，而是根据任务的可执行性动态调整顺序。

## unresolvedTaskIds 的构建

```typescript
const unresolvedTaskIds = new Set(
  tasks.filter(t => t.status !== 'completed').map(t => t.id)
);
```

这个集合包含所有**非 completed** 的任务 ID。它是用来判断"某个 task 的依赖是否还未解决"的基础集合。

为什么用 `!== 'completed'` 而不是用 `=== 'pending' || === 'in_progress'`？

因为语义更清晰：任何任务只要还没完成，就构成对依赖它的任务的阻塞。"已完成"才是不阻塞的，其他所有状态（pending、in_progress、canceled 等）都可能继续阻塞。

## pending 任务的排序逻辑

```typescript
const pending = tasks.filter(t => t.status === 'pending').sort((a, b) => {
  const aBlocked = a.blockedBy.some(id => unresolvedTaskIds.has(id));
  const bBlocked = b.blockedBy.some(id => unresolvedTaskIds.has(id));
  if (aBlocked !== bBlocked) {
    return aBlocked ? 1 : -1;  // 被阻塞的往后排
  }
  return byIdAsc(a, b);  // 同级的按 ID 升序
});
```

核心判断：`blockedBy.some(id => unresolvedTaskIds.has(id))`

这检查的是：这个 pending 任务的 `blockedBy` 列表里，是否有任何任务还未完成。有，就是被阻塞的；没有，就是可以立刻开始的。

**为什么是 `some` 而不是 `every`？**

`some` 意味着"只要有一个前置任务未完成，就算阻塞"。这是正确的：任务 A 依赖 B 和 C，B 完成了但 C 没有，A 仍然被阻塞。`every` 会错误地认为"只有当所有前置都未完成时才算阻塞"。

## TaskItem 的阻塞显示

```typescript
// TaskItem 渲染
const isBlocked = openBlockers.length > 0;

// subject 显示
<Text bold={isInProgress} strikethrough={isCompleted} dimColor={isBlocked}>
  {displaySubject}
</Text>

// 阻塞原因
{isBlocked && (
  <Text dimColor>
    {" "}{figures.pointerSmall} blocked by{" "}
    {[...openBlockers].sort().map(id => `#${id}`).join(", ")}
  </Text>
)}
```

被阻塞的任务有三种视觉变化：

1. **subject 变灰（dimColor）**：表示"此刻无法推进"
2. **不显示 bold**：进行中的加粗是"热度"信号，阻塞的任务不该有热度感
3. **阻塞原因明确写出**：`▸ blocked by #2, #3`，不让用户猜

**`openBlockers` 的计算**

```typescript
openBlockers={task.blockedBy.filter(id => unresolvedTaskIds.has(id))}
```

注意：这里过滤的是"仍未解决的阻塞"，不是 `task.blockedBy` 的全部。如果 blockedBy 里有些任务已经完成了，不显示它们——它们不再构成阻塞，不需要出现在 "blocked by" 列表里。

## 这个排序体现的 UX 原则

**行动优先于记账**

列表的主要价值不是告诉用户"有哪些任务"，而是帮助用户"知道现在该做什么"。能立刻开始的 pending 排前面，体现了"帮助行动"的优先级高于"完整记录"的优先级。

**阻塞是显式的，不是隐式的**

很多任务管理工具里，阻塞只是一个关系（"任务 A 依赖任务 B"），不会主动告诉用户"你现在打不开 A"。这里把阻塞状态直接渲染到任务行上，并写出阻塞来源，是把依赖关系从"关系图"变成"当前可见状态"。

**不截断，不隐藏阻塞原因**

`blocked by #2, #3` 明确写出来，不是用"🔒"图标、不是"blocked（1）"这样的模糊提示。原因：用户需要知道是哪个任务在阻塞，才能判断"我要先推进哪个"。

## 边界情况

**如果 blockedBy 里有已删除的任务 ID？**

```typescript
openBlockers={task.blockedBy.filter(id => unresolvedTaskIds.has(id))}
```

删除的任务不在 `unresolvedTaskIds` 里（它只包含当前存在的非 completed 任务），所以已删除的 blockedBy 引用会被自然过滤掉。任务不再被视为阻塞。

**如果循环依赖？（A blockedBy B，B blockedBy A）**

两个任务都会被认为是 blocked，都会往后排，都会显示阻塞提示。从 UI 角度看，这是正确的——两个任务都无法推进。循环依赖本身是数据问题，UI 诚实地反映了"这两个任务都卡住了"的事实。

## 面试指导

**直接问法**："pending 任务是按什么顺序排的？"

答：未被阻塞的排前面（`blockedBy.some(id => unresolvedTaskIds.has(id))` 为 false），被阻塞的排后面。同级内按 ID 升序。阻塞判断是实时计算的（依赖 unresolvedTaskIds 这个当前未完成任务的集合）。

**追问**："任务行上的 'blocked by #2, #3' 里只显示哪些 ID？"

答：只显示"当前仍未完成的"阻塞任务 ID（`task.blockedBy.filter(id => unresolvedTaskIds.has(id))`）。已完成的前置任务不再阻塞，不出现在列表里。所以随着任务完成，"blocked by"列表会自然缩短，直到全部解除时任务变成可执行状态。

**系统追问**："这套阻塞显示和排序能支持动态更新吗？"

答：可以。`unresolvedTaskIds` 在每次渲染时从 tasks 实时计算，排序和显示也跟着重算。当某个 blockedBy 任务完成时，下一次渲染就会把依赖它的 pending 任务自动提前排序，同时从 blocked by 列表里移除。用户不需要手动刷新，协作状态的变化会自然反映在列表上。

---

*核心考察点：依赖感知排序逻辑、阻塞状态的显式 vs 隐式处理、some vs every 语义、动态状态的实时计算。*
