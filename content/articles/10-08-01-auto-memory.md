---
title: "auto-memory 记什么、不记什么？四类记忆类型的设计逻辑"
slug: "10-08-01-auto-memory"
date: 2026-04-09
topics: [上下文管理]
summary: "auto-memory 只记无法从代码状态派生的知识：user、feedback、project、reference 四类。代码模式、架构、git 历史不在记忆范围内，因为它们随时可以 grep 到。"
importance: 1
---

# auto-memory 记什么、不记什么？四类记忆类型的设计逻辑

"每轮都尽量多存一点"——这是最直觉的记忆策略。但 Claude Code 的 auto-memory 系统反其道而行，设计了明确的**不记什么**规则，并用四种类型约束了**只记什么**。

---

## 四种记忆类型

来自 `memoryTypes.ts`：

```typescript
export const MEMORY_TYPES = ['user', 'feedback', 'project', 'reference'] as const
```

**user（用户记忆）**：关于用户本人的知识。用户是数据科学家还是后端工程师？偏好简洁回答还是详细说明？这类知识帮助模型"了解服务的对象是谁"，从而调整回应方式。

**feedback（反馈记忆）**：用户对模型行为的纠正和确认。"不要用 mock，我们被 mock 坑过"、"每次做完不要总结，我能看 diff"。这类记忆是"下次不用再说一遍"的行为约束。

**project（项目记忆）**：关于正在进行的工作的非显式信息。"这个重构是因为法务要求，不是技术债"、"周四以后代码冻结，移动团队要发版"。这类信息从代码历史里看不出来，但对决策很重要。

**reference（引用记忆）**：外部系统的位置信息。"bug 追踪在 Linear 的 INGEST 项目"、"这个 Grafana 看板是 oncall 监控的"。

---

## 精确的不记原则

`memoryTypes.ts` 里的 `WHAT_NOT_TO_SAVE_SECTION` 列出了明确不保存的内容：

```
不要保存：
- 代码模式、架构、文件路径、项目结构 — 可以通过读当前项目状态派生
- Git 历史、最近改动、谁改了什么 — git log/blame 是权威来源
- 调试方案或修复步骤 — fix 在代码里，commit message 有上下文
- CLAUDE.md 里已经有的内容
- 临时任务细节：进行中的工作、临时状态、当前对话上下文
```

最后一条有一个特殊规则：
> 这些排除条款即使在用户明确要求保存时也适用。如果用户要求保存"这周的 PR 列表"，问他们其中哪些是**意外的或非显而易见的**——那才是值得保留的部分。

这条规则防止了"把活动日志当记忆"的反模式：用户有时候会要求记录一些表面上"有用"但实际上只是当前活动噪音的内容。

---

## "可派生"是关键判断标准

四类记忆的共同特点：**无法从当前代码状态派生**。

什么叫"可以派生"？
- "这个项目用 TypeScript"——`ls *.ts` 就能知道，不需要记
- "auth.ts 里有一个 validateJWT 函数"——`grep validateJWT src/` 能找到，不需要记
- "上周 Alice 修改了 user.ts"——`git log src/user.ts` 能看到，不需要记

什么叫"无法派生"？
- "这个项目里 Bob 是 Go 专家但对 React 陌生"——git log 看不出来
- "不要用 mock，上个季度 mock 测试通过了但 prod migration 失败了"——从代码里看不出来这个历史教训
- "这个认证重构是法务要求的，不是技术债"——代码里看不出动机

记忆的价值在于"补充当前不可观察的上下文"，而不是"重复当前可观察的内容"。

---

## extractMemories 的触发条件

```typescript
// stopHooks.ts 里的触发检查
if (
  feature('EXTRACT_MEMORIES') &&
  !toolUseContext.agentId &&   // 只在主 agent（非子 agent）里运行
  isExtractModeActive()         // 记忆提取模式需要被激活
) {
  void extractMemoriesModule!.executeExtractMemories(
    stopHookContext,
    toolUseContext.appendSystemMessage,
  )
}
```

提炼只在**主 agent** 里触发，不在子 agent 里。原因是：子 agent 的对话历史是主 agent 任务的一个分支，没有代表整个项目上下文的资格。只有主 agent 能看到完整的用户交互，才有能力判断什么值得长期保留。

`isExtractModeActive()` 是一个单独的开关，说明 auto-memory 提取是可以被禁用的（比如 `--bare` 模式下就不运行）。

---

## hasMemoryWritesSince：避免重复提炼

```typescript
function hasMemoryWritesSince(messages, sinceUuid): boolean {
  // 检查主 agent 在 sinceUuid 之后是否已经写过 auto-memory 路径
}
```

在 `runExtraction` 里：

```typescript
if (hasMemoryWritesSince(messages, cursor.lastRunUuid)) {
  // 主 agent 已经手动写过记忆，跳过后台提炼
  advanceCursor(...)
  return
}
```

主 agent 有完整的记忆写入指令，如果它主动写了记忆（比如用户说"记一下这个决策"），后台提炼 agent 就不再重复工作。这是"人工优先于自动化"的原则：如果人工（或主 agent）已经做了，自动化就让开。

---

## 记忆的时效性问题

auto-memory 里有一个专门的 drift caveat：

```typescript
export const MEMORY_DRIFT_CAVEAT =
  '- Memory records can become stale over time. Use memory as context for what was true at a given point in time. Before answering, verify that the memory is still correct by reading the current state of the files or resources. If a recalled memory conflicts with current information, trust what you observe now — and update or remove the stale memory.'
```

记忆会过时。"Bob 是 React 新手"这个记忆在六个月后可能不再成立。"下周有代码冻结"的 project memory 在下周过后就失效了。

系统的处理方式是：**记忆是起点，不是终点**。用记忆作为背景假设，但在行动前验证。如果记忆和当前观察冲突，信任当前观察，并更新/删除过时记忆。

---

## 面试指导

"自动记忆系统应该记什么"是一道设计题，关键是理解"有用性 vs 可观察性"的分层。

好的答案：
1. **只记不可派生的**：可以从代码、git、文档派生的不需要记
2. **四种类型覆盖不同维度**：用户偏好、行为约束、项目状态、外部引用
3. **记忆会过时**：需要"验证后使用"的机制，不能盲目信任
4. **宁少勿滥**：过多记忆降低质量，被当前工作噪音淹没的记忆反而有害

第 4 点是最难说出来的，因为"多存一点"的直觉太强。能说清楚"为什么记忆系统的克制性是优点而不是缺点"，说明你理解了信噪比在长期记忆系统里的核心地位。
