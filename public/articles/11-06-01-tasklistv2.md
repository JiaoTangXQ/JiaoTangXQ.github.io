---
title: "面试题：TaskListV2 是如何根据终端行数动态决定显示哪些任务的？maxDisplay 算法解析"
slug: "11-06-01-tasklistv2"
date: 2026-04-09
topics: [终端界面]
summary: "TaskListV2 不是把所有任务都塞进去——它先算出终端还剩多少行，再从这个容量出发，做任务的优先级分发。这是一个把屏幕约束直接编码进显示逻辑的典型案例。"
importance: 1
---

# 面试题：TaskListV2 是如何根据终端行数动态决定显示哪些任务的？maxDisplay 算法解析

这道题测试你是否理解"约束驱动 UI"的设计方式。答案不复杂，但能把三个层级（容量计算、优先级排序、摘要生成）都说清楚的候选人，展示了系统性的工程思维。

## maxDisplay 的计算

```typescript
const maxDisplay = rows <= 10 ? 0 : Math.min(10, Math.max(3, rows - 14));
```

这一行代码决定了"最多能显示几条任务"：

- `rows <= 10`：终端太矮，整个任务区退出，`maxDisplay = 0`
- 正常情况：`Math.min(10, Math.max(3, rows - 14))`
  - 最少显示 3 条（`Math.max(3, ...)`）
  - 最多显示 10 条（`Math.min(10, ...)`）
  - 基准是 `rows - 14`：终端总行数减去非任务区占用（输入框、底部、logo、状态栏等大约 14 行）

**为什么减 14？**

这是一个经验值，代表非任务区的固定行数消耗。这 14 行大约是：logo 区域（3-4 行）、状态栏（1 行）、输入区（2-3 行）、底部提示（1 行）等。`rows - 14` 就是任务区可以"自由使用"的剩余行数。

**为什么有 [3, 10] 的夹紧范围？**

- 下限 3：即使终端只有 17 行（14 + 3），也至少显示 3 条任务，因为"1-2 条任务"的显示意义不大
- 上限 10：超过 10 条任务在一个面板里显示效果会很差，而且注意力分散，总量超过 10 时应该用摘要代替完整列表

## 优先级排序：谁先进屏

当 `tasks.length > maxDisplay` 时，需要决定哪些任务能进可视区：

```typescript
const recentCompleted: Task[] = [];   // 30s 内刚完成
const olderCompleted: Task[] = [];    // 更早完成
const inProgress = tasks.filter(t => t.status === 'in_progress').sort(byIdAsc);
const pending = tasks.filter(t => t.status === 'pending').sort((a, b) => {
  // 先放能动的（未被阻塞），再放被卡住的
  const aBlocked = a.blockedBy.some(id => unresolvedTaskIds.has(id));
  const bBlocked = b.blockedBy.some(id => unresolvedTaskIds.has(id));
  if (aBlocked !== bBlocked) return aBlocked ? 1 : -1;
  return byIdAsc(a, b);
});

const prioritized = [...recentCompleted, ...inProgress, ...pending, ...olderCompleted];
```

优先级从高到低：
1. **最近完成**（30s 内）：给用户确认反馈
2. **进行中**：当前活跃工作
3. **待处理**（能动的先于被阻塞的）：可以推进的任务
4. **更早完成**：历史记录，最低优先级

这个顺序的逻辑是：让用户一眼看到"现在能做什么"和"刚刚完成了什么"，而不是被一堆完成的历史任务淹没。

## hiddenSummary：压缩但不隐瞒

超出 `maxDisplay` 的任务不是直接丢掉，而是变成一行摘要：

```typescript
if (hiddenTasks.length > 0) {
  const parts: string[] = [];
  if (hiddenInProgress > 0) parts.push(`${hiddenInProgress} in progress`);
  if (hiddenPending > 0) parts.push(`${hiddenPending} pending`);
  if (hiddenCompleted > 0) parts.push(`${hiddenCompleted} completed`);
  hiddenSummary = ` … +${parts.join(', ')}`;
}
```

`… +3 in progress, 2 pending, 8 completed` 这样一行摘要，让用户知道后面还有什么类型的任务，不是一个模糊的"还有更多"。

**为什么不只写 "+13 more"？**

因为"13 more"没有告诉用户这 13 个里有多少是需要关注的（in progress）和需要推进的（pending），有多少只是历史记录（completed）。`"+3 in progress, 2 pending, 8 completed"` 让用户能判断"后台有多少活跃工作"，不需要展开就能建立整体感知。

## 无截断时的稳定排序

如果 `tasks.length <= maxDisplay`（不需要截断），就用简单的 ID 升序排列：

```typescript
visibleTasks = [...tasks].sort(byIdAsc);
```

```typescript
function byIdAsc(a: Task, b: Task): number {
  const aNum = parseInt(a.id, 10);
  const bNum = parseInt(b.id, 10);
  if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
  return a.id.localeCompare(b.id);
}
```

数字 ID 按数值排（不按字符串排，避免 "10" < "2" 的问题），非数字 ID 按字典序。这是一个 stable sort 的实现。

## standalone 模式的总览行

```typescript
if (isStandalone) {
  return (
    <Box flexDirection="column" marginTop={1} marginLeft={2}>
      <Box>
        <Text dimColor>
          <Text bold>{tasks.length}</Text>
          {' tasks ('}
          <Text bold>{completedCount}</Text>
          {' done, '}
          {inProgressCount > 0 && <><Text bold>{inProgressCount}</Text>{' in progress, '}</>}
          <Text bold>{pendingCount}</Text>
          {' open)'}
        </Text>
      </Box>
      {content}
    </Box>
  );
}
```

standalone 模式（独立展示，不嵌入底部区域）会先给一行汇总：`12 tasks (5 done, 3 in progress, 4 open)`，再往下列具体任务。这让用户先建立整体感知，再看细节。

## 面试指导

**直接问法**："TaskListV2 如何决定显示几条任务？"

答：用 `rows - 14` 计算可用行数，夹紧到 [3, 10] 的范围。终端 <= 10 行时整个面板退出（maxDisplay=0）。这样任务区始终贴合终端实际可用空间。

**追问**："超出部分是怎么处理的？"

答：按优先级（最近完成 → 进行中 → 未阻塞 pending → 更早完成）填满 maxDisplay 个槽位，超出的变成一行摘要（`… +N in progress, M pending, K completed`）。不是粗暴截断，而是保留结构感知。

**深层追问**："为什么不总是显示最多 10 条，而要动态计算？"

答：因为终端行数直接影响用户能看到的内容总量。如果终端只有 18 行，显示 10 条任务会把整个消息区挤没。动态计算让任务区"自知其位"，不越权占用消息区的空间。这是一种"组件主动感知约束"的设计，而不是"不管环境只管自己"的设计。

**代码细节追问**："`rows <= 10 ? 0` 这个临界值怎么定出来的？"

答：经验值，表示终端极度紧张（只有 10 行）时，任务面板本身的显示就没有意义了，其他界面元素（输入框、状态栏）更需要那些行。这时把任务区完全隐藏，而不是挤出 3 条效果很差的任务行，是更保守也更正确的选择。

---

*核心考察点：约束驱动 UI 设计、优先级排序逻辑、摘要 vs 截断的选择、动态计算 vs 硬编码的取舍。*
