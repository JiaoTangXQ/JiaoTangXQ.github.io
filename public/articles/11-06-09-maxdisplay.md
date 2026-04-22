---
title: "面试题：maxDisplay 为 0 时任务面板是如何完全退出的？小屏模式的降级策略"
slug: "11-06-09-maxdisplay"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# 面试题：maxDisplay 为 0 时任务面板是如何完全退出的？小屏模式的降级策略

这道题考察的是"面板如何知道自己不该出现，以及如何干净地退出"。

## 完全退出的链式逻辑

当 `rows <= 10` 时：

```typescript
const maxDisplay = rows <= 10 ? 0 : Math.min(10, Math.max(3, rows - 14));
```

`maxDisplay = 0`，然后：

```typescript
const needsTruncation = tasks.length > maxDisplay;  // tasks.length > 0 → true

// 进入截断分支
visibleTasks = prioritized.slice(0, 0);  // 空数组！
hiddenTasks = prioritized.slice(0);      // 所有任务都在这里
```

```typescript
// hiddenSummary 的守卫
{maxDisplay > 0 && hiddenSummary && <Text dimColor>{hiddenSummary}</Text>}
// maxDisplay = 0，条件为 false，hiddenSummary 不渲染
```

结果：
- `visibleTasks` = 空数组 → 没有任务行渲染
- `hiddenSummary` = 不渲染（守卫条件 `maxDisplay > 0` 为 false）
- `content` = 空

只剩下 standalone 模式的总览行（如果 `isStandalone` 为 true）：

```typescript
if (isStandalone) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text dimColor>12 tasks (5 done, 3 in progress, 4 open)</Text>
      </Box>
      {content}  {/* content 是空的 */}
    </Box>
  );
}
return <Box flexDirection="column">{content}</Box>;  // 空 Box
```

非 standalone 模式下，返回的是一个空的 `<Box>`，Yoga 会把它渲染成 0 高度。

## 为什么选择完全退出而不是"最少显示 1 条"

**极矮终端的空间分配**

一个只有 10 行的终端，这 10 行大约是：
- logo/header：1-2 行
- 输入区：2-3 行
- 状态栏：1 行
- 底部提示：1 行

剩下可能只有 2-3 行给消息区。如果还要挤出 1-2 条任务行，消息区就缩到只剩 1 行了——这比没有任务面板更糟糕，因为消息区才是用户最需要看到的主内容。

**"少显示一些"和"完全不显示"的语义差异**

如果显示 1 条任务，用户可能以为"只有 1 个任务"，然后困惑为什么没有其他任务。这是"部分显示导致误解"的陷阱。

完全不显示，用户知道"这个面板在当前终端状态下不可用"，会去其他入口查看任务（比如用 `/tasks` 命令）。这是更清晰的空状态。

## 早期退出守卫

```typescript
if (!isTodoV2Enabled()) {
  return null;
}
if (tasks.length === 0) {
  return null;
}
```

在计算 maxDisplay 之前，有两个更早的退出守卫：

1. `!isTodoV2Enabled()`：feature flag 关闭时整个组件不渲染
2. `tasks.length === 0`：没有任务时不渲染

这三层退出（feature flag → 无任务 → maxDisplay=0）体现了一个模式：**每一层退出都有独立的原因，不应该混在一起**。

## rows 来自哪里

```typescript
const { rows, columns } = useTerminalSize();
```

`useTerminalSize()` 是一个 hook，它监听 `process.stdout.on('resize')` 事件，在终端窗口大小改变时触发重渲染。这意味着：
- 用户拉大终端 → rows 增加 → maxDisplay 增加 → 更多任务出现
- 用户压小终端 → rows 减少 → maxDisplay 减少 → 更少任务（或 0）

任务面板的显示是实时响应终端大小变化的。

## 不同 rows 值的 maxDisplay 映射

| rows | maxDisplay | 说明 |
|------|-----------|------|
| ≤ 10 | 0 | 完全退出 |
| 17 | 3 | 最少保证 |
| 20 | 6 | 正常范围 |
| 24 | 10 | 上限 |
| ≥ 24 | 10 | 不再增加 |

10 的上限确保任务面板不会在超大终端里占据过多空间——10 条任务是一次视觉扫读的合理上限，超过的用摘要替代。

## 面试指导

**直接问法**："maxDisplay=0 时，面板里还渲染什么？"

答：visibleTasks 空数组不渲染任何任务行；hiddenSummary 因为 `maxDisplay > 0` 守卫而不渲染；非 standalone 模式返回空 Box（高度 0）；standalone 模式只有总览行没有具体任务行。实质上是完全退出。

**追问**："为什么不显示至少 1 条而是直接 0 条？"

答：极矮终端里任务面板本身不该抢占消息区的空间。显示 1 条会让用户误以为只有 1 个任务，造成误解。完全退出是更诚实的空状态——用户知道这个面板在当前条件下不可用，会去其他入口查看任务。

**系统追问**："maxDisplay 上限为 10 是怎么定的？"

答：经验值，代表一次视觉扫读的合理范围。超过 10 条任务同时显示，人眼很难快速找到关注点，效果不如分类摘要。10 也是给任务面板的空间预算上限——即使终端有 100 行，任务面板也不应该用超过 10 行。

**代码细节**："`tasks.length === 0` 的早期退出和后面的 maxDisplay=0 处理，哪个更重要？"

答：前者更重要，因为它避免了无意义的计算（计算 maxDisplay、建排序、生成 hiddenSummary）。但两者分别处理不同的情况：前者是"没有任务数据"，后者是"有任务数据但屏幕太小"。分开处理更清晰，不应该合并到一个条件里。

---

*核心考察点：面板的优雅退出策略、极端情况下的空间分配决策、分层退出守卫的设计、实时响应终端大小变化。*
