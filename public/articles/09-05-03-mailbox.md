---
title: "TeammateMessage 为什么有 summary 和 color 字段？看似 UI 装饰的字段实际是协作基础设施"
slug: "09-05-03-mailbox"
date: 2026-04-09
topics: [多Agent协作]
importance: 1
---

# TeammateMessage 为什么有 summary 和 color 字段？看似 UI 装饰的字段实际是协作基础设施

`TeammateMessage` 的完整结构：

```typescript
export type TeammateMessage = {
  from: string       // 发送者名称
  text: string       // 消息正文
  timestamp: string  // ISO 时间戳
  read: boolean      // 是否已读
  color?: string     // 发送者颜色（red, blue, green...）
  summary?: string   // 5-10 词的摘要
}
```

前四个字段很直观：谁发的、内容是什么、什么时候发的、读没读。

但 `color` 和 `summary`，乍一看像是为了让 UI 更好看而加的。为什么这两个字段要存在消息对象里，而不是在前端渲染时查询 UI 状态来计算？

## color 字段的工程意义

假设 `color` 不在消息里，只存在 UI 状态里。领导界面收到一条来自 `researcher` 的消息，要显示颜色，需要：

1. 读取消息的 `from` 字段（"researcher"）
2. 在 AppState 里找 researcher 的 color 配置
3. 拿到 color，渲染彩色边框

这在简单场景里能工作。但考虑这些边缘情况：

**消息历史查看**：用户查看 30 分钟前的消息记录。那时的 researcher 已经被踢出团队，AppState 里不再有它的颜色信息。颜色显示空白或使用默认色，用户分不清那条消息是谁发的。

**日志导出**：把消息记录导出为文件或发给另一个系统。颜色信息留在运行时状态里，导出的文件丢失了颜色信息，接收方无法还原原始的视觉上下文。

**headless 模式处理**：某些处理消息的代码不运行在有 UI 的环境里。它需要知道消息来自哪个颜色标识的 agent（比如权限审批日志），但没有 AppState 可查。

把 `color` 存在消息里，就像把发件人的部门信息印在邮件抬头上——不管这封邮件在哪里被查看、什么时候被查看，信息始终跟着邮件走。

## summary 字段的工程意义

5 个 teammate 同时工作时，leader 的消息收件箱可能积累几十条待读消息。没有 summary，leader（AI 或人类）必须展开每条消息才能判断优先级：这条要立刻处理，还是可以稍后再说？

`summary` 字段（5-10 词的描述）让这个判断变成不需要展开的快速浏览：

```
[researcher] "发现了 API 返回值不一致问题，需要讨论方向"  ← 高优先级
[reviewer]   "样式规范检查完成，没有问题"               ← 低优先级
[tester]     "测试用例全部通过"                         ← 低优先级
```

leader 可以在不读完整消息的情况下，正确排列消息的处理顺序。

但注意：**summary 字段是由发送方填写的**，不是接收方生成的。这意味着：

1. **发送方需要主动思考摘要**：写 summary 的过程迫使发送方在发消息时思考"我这条消息的核心是什么"，这本身就是一种信息过滤。
2. **摘要反映发送方的优先级判断**：如果 researcher 认为这条消息非常重要，它会在 summary 里写"紧急：发现了 security vulnerability"，而不是"找到了一些问题"。接收方可以通过 summary 的措辞感受到发送方认为的紧急程度。
3. **summary 可能和 text 内容不同**：text 是完整的思考过程，summary 是精炼的结论。这允许消息同时满足"快速浏览"和"深入阅读"两种需求。

## read 字段的并发安全

`read` 字段的更新也走了完整的锁后重读：

```typescript
export async function markMessageAsReadByIndex(
  agentName: string,
  index: number,
): Promise<void> {
  const lockRelease = await lockfile.lock(...)
  try {
    // 锁后重读，确保在修改 read 状态时不丢失新到的消息
    const messages = await readMessages(inboxPath)
    if (messages[index]) {
      messages[index]!.read = true
      await writeFile(inboxPath, JSON.stringify(messages))
    }
  } finally {
    await lockRelease()
  }
}
```

为什么标记已读也需要锁后重读？

在标记 `messages[3]` 为已读的过程中，可能有新消息到达，被追加到 `messages[4]` 的位置。如果用锁之前读取的 messages 数组写回，`messages[4]` 的新消息会被覆盖丢失。

这是同一个"锁后重读"原则的又一个应用——任何"读取 → 修改 → 写回"的操作，在并发场景下都需要"在锁内重读"。

## 消息状态机的完整设计

把六个字段放在一起看，TeammateMessage 实际上是一个小型状态机：

```
发送时：
  from       ← 永久记录发送者
  text       ← 完整内容
  summary    ← 发送时由发送方生成（可选）
  color      ← 从发送方的 TeammateContext 里读取
  timestamp  ← 发送时刻的 ISO 时间戳
  read: false  ← 初始状态：未读

收到并处理后：
  read: true   ← 状态变为：已读
```

read 字段的状态转换（false → true）就是这个状态机唯一的状态变化。一旦变为 true，就不会再变回 false——消息没有"未读"操作。

这和邮件系统的设计是一致的：邮件可以被标记为已读，但没有"取消已读"的功能。这简化了状态管理，也防止了"已读状态循环更新"造成的竞态。

## 面试怎么答

如果面试题是"消息对象里应该包含哪些字段"：

**表面答案**：内容、时间戳、发送者。这是最基本的。

**深入答案**：还要考虑消息在脱离原始上下文时的可解读性。如果消息需要在 UI 上显示、在日志里记录、被另一个系统处理，它携带的信息应该足够自解释——不需要查询外部状态才能理解"这条消息是谁发的、什么重要程度"。

**实际工程**：色彩信息（color）和摘要（summary）看起来是"UI 层"的东西，放在数据模型里似乎违反关注点分离。但当数据需要跨越多个系统边界（UI、日志、审计、headless 处理），把这些"显示属性"放在数据里，实际上是让数据更加自包含，减少了接收方的查询负担。这是在"关注点分离"和"数据自描述"之间的一个实用主义取舍。
