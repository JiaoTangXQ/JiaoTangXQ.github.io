---
title: "sticky prompt 是怎么从滚动位置反推出来的？StickyTracker 的逆向查找"
slug: "11-09-02-sticky-prompt"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# sticky prompt 是怎么从滚动位置反推出来的？StickyTracker 的逆向查找

sticky prompt 是 Claude Code 全屏模式下顶部显示的"当前在看哪条用户提问"提示。它看起来简单，但实现上有几个不明显的设计决策。

## 什么是 sticky prompt

全屏模式下，transcript 很长，用户可能滚动到 Claude 回复的中间。这时顶部显示一个 header，内容是"触发这段回复的用户提问"，让用户知道自己在看什么问题的答案。

当用户滚动到不同位置时，header 自动更新为最近的上方用户 prompt。这是一个典型的"你现在在哪"指示器。

## stickyPromptText 的过滤逻辑

不是所有 `type === 'user'` 的消息都算 sticky prompt 候选。`computeStickyPromptText` 有一套过滤：

```typescript
function computeStickyPromptText(msg: RenderableMessage): string | null {
  let raw: string | null = null
  
  if (msg.type === 'user') {
    if (msg.isMeta || msg.isVisibleInTranscriptOnly) return null
    const block = msg.message.content[0]
    if (block?.type !== 'text') return null
    raw = block.text
  } else if (msg.type === 'attachment' && 
             msg.attachment.type === 'queued_command' &&
             msg.attachment.commandMode !== 'task-notification' &&
             !msg.attachment.isMeta) {
    // 工具执行期间 mid-turn 发出的命令
    const p = msg.attachment.prompt
    raw = typeof p === 'string' ? p : p.flatMap(...)
  }
  
  if (raw === null) return null
  const t = stripSystemReminders(raw)
  if (t.startsWith('<') || t === '') return null  // XML 包装的系统消息
  return t
}
```

关键过滤：
1. `isMeta` 消息（会话内部的元信息）不显示
2. `isVisibleInTranscriptOnly` 的消息不显示
3. 以 `<` 开头的文本（XML 包装的 bash-stdout、command-message、teammate-message）不显示
4. 先 `stripSystemReminders`（去掉 `<system-reminder>` 块），再检查剩余文本

## WeakMap 缓存：每次滚动只算一次

StickyTracker 在每次滚动时遍历可见窗口附近的消息，找到最近的 prompt。遍历过程中对每条消息调用 `stickyPromptText`。

问题：一次滚动可能触发几十次调用，而 `stripSystemReminders` 需要解析字符串（内存分配）。

解法：`promptTextCache` 是一个 `WeakMap<RenderableMessage, string | null>`，以消息对象为键，缓存计算结果：

```typescript
const promptTextCache = new WeakMap<RenderableMessage, string | null>()

function stickyPromptText(msg: RenderableMessage): string | null {
  const cached = promptTextCache.get(msg)
  if (cached !== undefined) return cached  // 命中缓存
  const result = computeStickyPromptText(msg)
  promptTextCache.set(msg, result)
  return result
}
```

WeakMap 的选择很精妙：消息数组是 append-only 的，不会修改已有消息的内容，所以以消息对象为键的缓存永远有效（只要对象还存在）。当 transcript 被 compacted（early messages 被替换为 summary），旧的消息对象被垃圾回收，WeakMap 里对应的缓存条目自动释放，不需要手动清理。

## StickyTracker 的反向查找

`StickyTracker` 是 `VirtualMessageList` 里的一个子逻辑，在每次滚动事件后运行：

```
当前 scrollTop = 300（视口顶部在文档的第 300 行）

从 messages 数组里，找最后一个满足：
  - stickyPromptText(msg) !== null（是真实用户 prompt）
  - getItemTop(msgIndex) < scrollTop（消息顶部在视口上方）
```

这是反向遍历：从当前可视区往上找，找到离视口顶部最近的用户 prompt。找到后把它的文本和 `scrollTo` 回调写进 `ScrollChromeContext`，让 `FullscreenLayout` 显示在 header 里。

## 'clicked' 状态

`StickyPrompt` 类型有一个特殊值：

```typescript
type StickyPrompt = {
  text: string
  scrollTo: () => void
} | 'clicked'
```

当用户点击 sticky header（"跳回到这条 prompt"），sticky prompt 被设为 `'clicked'`。这时 header 隐藏但 padding 保持为 0（不是 1），让内容 `❯` 落在屏幕行 0 而不是行 1。下次用户滚动时，StickyTracker 重新计算，`'clicked'` 状态被清除。

## 面试指导

这道题考察你是否理解"UI 状态的来源不一定是事件触发，也可以是位置推断"。

**核心区别**：大多数 UI 状态是"用户做了某件事 → 状态变化"。sticky prompt 是"用户滚动到某个位置 → 系统从位置推断状态"。这是逆向的，是把位置解释成语义。

**WeakMap vs Map 的考点**：WeakMap 的 key 必须是对象（不能是 string 或 number），但好处是 key 对象被 GC 时条目自动消失，不需要手动管理缓存失效。对于"以对象为 key，对象生命周期和缓存生命周期一致"的场景，WeakMap 比 Map 更合适。

**追问**：sticky prompt 文本有 500 字符上限（`STICKY_TEXT_CAP = 500`），为什么？因为巨大的粘贴 prompt（`cat file | claude`）会撑开 header 区域，导致内容区域被压缩。500 字符截断后 header 最多占 2 行（`overflow: hidden`），不会影响主内容区域的布局。

**延伸设计问题**：如果 transcript 里没有任何用户 prompt 在视口上方（用户在看最开头），sticky prompt 应该显示什么？答：null，不显示 header。源码里是 `setSticky(null)`，FullscreenLayout 在 sticky 为 null 时不渲染 header 组件。
