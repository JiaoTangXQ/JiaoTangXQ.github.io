---
title: "microcompact 为什么只清工具结果，不动对话历史？"
slug: "10-02-01-microcompact"
date: 2026-04-09
topics: [上下文管理]
summary: "microcompact 的精准边界：只清除已完成的工具结果，保留对话轨迹和思维块，是最小侵入的上下文减负方案。"
importance: 1
---

# microcompact 为什么只清工具结果，不动对话历史？

面试问题变体："你在设计 LLM Agent 的上下文清理策略时，如何决定什么可以删、什么必须保留？"

microcompact 给出了一个非常有说服力的答案。

---

## 先看现象：什么最占空间

在一个真实的 Claude Code 长会话里，token 分布大概是这样的：
- 工具调用结果（tool_results）：50-70%
- 模型的回应和思考：20-30%
- 用户输入：5-10%

工具结果为什么这么重？因为它们是原始输出，没有压缩。读一个 300 行的 TypeScript 文件，就是 300 行塞进去。跑一条 bash 命令输出了 500 行日志，那 500 行都在。

而且这些工具结果在使用完之后，大多数就"没用"了——模型已经从中提取了需要的信息，原始内容继续占着位置只是历史负担。

---

## microcompact 的核心逻辑

从 `microCompact.ts` 可以看到可清除工具的白名单：

```typescript
const COMPACTABLE_TOOLS = new Set<string>([
  FILE_READ_TOOL_NAME,     // read_file
  ...SHELL_TOOL_NAMES,     // bash 等
  GREP_TOOL_NAME,
  GLOB_TOOL_NAME,
  WEB_SEARCH_TOOL_NAME,
  WEB_FETCH_TOOL_NAME,
  FILE_EDIT_TOOL_NAME,     // 编辑确认输出
  FILE_WRITE_TOOL_NAME,    // 写入确认输出
])
```

注意这个白名单的特点：**都是"一次性消耗"的工具**。你读了一个文件，信息已经在模型的理解里了；你搜索了一次，结果已经被引用了。这些工具的结果在被处理之后，保留原始内容的价值极低。

被清除的工具结果会被替换成一个占位符：
```
[Old tool result content cleared]
```
这个 `TIME_BASED_MC_CLEARED_MESSAGE` 常量定义在 `microCompact.ts` 里，是为了让模型知道"这里曾经有个结果，但已经被清除了"，而不是简单地消失。

---

## 什么不在白名单里

关键是看什么**没有**被列入可清除列表：
- Agent tool 的调用结果（子 agent 的完整执行历史）
- 思考块（thinking blocks）
- 用户消息
- 模型回应的文本部分

这些不被清除，原因各不同：

**用户消息和模型回应文本**是对话的骨架。你把对话历史删了，模型就失去了理解"我们在讨论什么"的上下文。这是不可压缩的核心。

**思考块**有更严格的协议约束。源码注释写得很清楚（`query.ts` 顶部的"规则"注释）：思考块必须在整个 assistant trajectory 中保留，不能被截断。这是 API 层面的硬要求，不是设计选择。

**子 agent 的调用结果**包含了一次完整任务的执行摘要，删掉可能让模型不知道那个任务的状态。这类结果更类似"对话内容"而不是"工具原始输出"。

---

## 时间触发 vs 内容触发

microcompact 有两种触发模式：

**内容触发**：token 数超过阈值，选择最老的工具结果清除，直到低于目标 token 数。默认阈值 180K，目标保留 40K：

```typescript
const DEFAULT_MAX_INPUT_TOKENS = 180_000
const DEFAULT_TARGET_INPUT_TOKENS = 40_000
```

**时间触发**（time-based）：如果距上次 assistant 消息超过一定时间（缓存可能已失效），不管 token 数如何，先做一轮清除。逻辑是：缓存都失效了，就没必要保留那些本来是为了"cache hit 友好"而留下的内容了，不如趁机清掉，让下一次请求更小。

时间触发完成后，`maybeTimeBasedMicrocompact()` 返回结果，整个 `microcompactMessages()` 直接返回，不进入 cached microcompact 路径。这是个短路逻辑——既然已经处理了，就跳过后面更复杂的路径。

---

## 为什么先做 microcompact 再做 autocompact？

这个顺序是关键的工程决策。

如果先做 autocompact（系统级重写），那 microcompact 就没有意义了——整个历史都被替换成摘要了，工具结果自然消失。反过来，先做 microcompact，有可能把 token 数压到 autocompact 阈值以下，从而避免一次昂贵的系统级压缩。

```
microcompact 之后的 token 数 < autocompact 阈值
→ 这轮不需要 autocompact
→ 节省了一次 API 调用（大模型摘要请求）
```

这是"轻手段优先"的基本原则：能用局部方案解决的，不用系统级方案。microcompact 是 O(本地操作)，autocompact 是 O(一次额外 API 调用)，量级差了很多。

---

## Ant 内部的 cached microcompact

外部版本的 microcompact 是在本地直接修改消息数组（删除 tool_result 内容）。Ant 内部版本（`CACHED_MICROCOMPACT` feature flag）有更精巧的实现：通过 API 的 cache editing 接口，在服务端直接删除已缓存的工具结果，而不是让修改后的消息重新参与 cache rewrite。

这样的好处是：删除操作本身不产生新的 cache_creation token。外部版本的删除操作会导致 prompt cache 部分失效，因为被修改的消息后面的所有内容都要重新缓存。

---

## 面试指导

这道题考察的是"精确手术 vs 大范围清理"的取舍意识。

好的答案应该提到：
1. 不是所有历史都等价——工具结果和对话历史的"价值衰减速度"不同
2. 清除有白名单，不能随便清——思维块、用户消息有协议约束
3. 轻量机制优先——先局部清理，再考虑系统级压缩
4. 顺序很重要——microcompact 在 autocompact 之前，可能避免触发后者
