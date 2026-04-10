---
title: "sticky prompt 只显示 500 字符和第一段，不是懒惰截断，是 breadcrumb 设计"
slug: "11-09-08-sticky-prompt"
date: 2026-04-09
topics: [终端界面]
summary: "stickyPromptText 先 stripSystemReminders 去掉系统注入内容，再取第一段，再用 STICKY_TEXT_CAP=500 限制长度。这三道过滤让 sticky header 只承担「找回入口」的职责，不复制正文。"
importance: 1
---

# sticky prompt 只显示 500 字符和第一段，不是懒惰截断，是 breadcrumb 设计

为什么 sticky header 不显示完整的用户 prompt？三道过滤的每一道都有具体理由。

## 第一道过滤：stripSystemReminders

原始 prompt 文本在存储前可能被注入 `<system-reminder>` 块：

```
<system-reminder>
你的记忆文件已更新。当前项目：FooBar。
</system-reminder>

如何优化这个函数的性能？
```

`<system-reminder>` 是 Claude Code 为了给模型补充上下文而插入的，不是用户输入的内容。如果 sticky header 显示这段文本，用户会看到自己从未输入过的内容，困惑且不信任。

`stripSystemReminders(text)` 的实现是找到并移除所有 `<system-reminder>...</system-reminder>` 块，返回真实的用户文本部分。

## 第二道过滤：startsWith('<') 检查

经过系统提醒剥离后，还有一类文本不适合显示：XML 包装的系统内容。

Claude Code 在某些场景下会把大段内容包在 XML 标签里发给模型：`<bash-stdout>`、`<command-message>`、`<teammate-message>` 等。这些通常是命令输出或系统消息，不是用户真正在问的问题。

`computeStickyPromptText` 的检查：

```typescript
const t = stripSystemReminders(raw)
if (t.startsWith('<') || t === '') return null
```

以 `<` 开头的直接排除——这说明用户"消息"的第一个字符就是 XML 标签，基本可以确定是系统包装的内容，不是真实问题。

## 第三道过滤：STICKY_TEXT_CAP = 500

用户可以在终端里粘贴很长的文本（`cat large_file | claude`），这些大段 prompt 可能有几 KB 甚至几十 KB。如果不截断，sticky header 会把整段文本塞进顶部栏，把内容区挤掉大半。

500 字符的上限确保 header 最多换行 2-3 行（根据终端宽度），不会造成布局失稳。实际的截断在 `StickyPromptHeader` 的渲染层处理（`text.slice(0, STICKY_TEXT_CAP)`），计算文本时不截断，只在渲染时截断。

## breadcrumb vs 正文复制

关键的设计意图是：sticky header 是**导航工具**，不是**内容展示**。

导航工具需要的是"让用户认出自己在哪里"，而不是"让用户能从 header 读懂这个问题"。一条 prompt 的前 100 个字符通常已经足够"认路"——用户知道自己之前问了什么，看到这 100 字就会想起上下文。

把整段 prompt 放进 header 是把导航工具做成了内容副本，反而会：
1. 让用户困惑"为什么这里也有这段文字"
2. 影响内容区的布局（挤占高度）
3. 在 prompt 被更新/编辑后，header 和实际内容可能不同步

breadcrumb 的设计就是：短、可认，指向位置，不复制内容。

## queued_command 也是候选

`stickyPromptText` 不只处理 `type === 'user'` 的消息，还处理 `type === 'attachment' && attachment.type === 'queued_command'` 的情况：

工具执行期间，用户可以继续输入命令（mid-turn prompt）。这些命令会以 attachment 形式存储，等工具执行完才正式进入会话。在这期间，这些 attachment 也是合法的"用户在问的问题"，应该出现在 sticky header 里。

排除 `commandMode === 'task-notification'` 和 `isMeta` 的 queued_command，因为这些是自动触发的，不是用户手动输入的。

## 面试指导

这道题考察"功能边界的控制"——知道一个 UI 组件的职责边界在哪里，以及如何通过过滤保持边界清晰。

**设计原则**：UI 组件的数据应该经过最小必要的过滤，只保留服务于该组件职责所需的部分。sticky header 的职责是"导航"，所以只需要"可认路"的短文本，不需要完整原文。

**面试追问**：如果用户的 prompt 第一段非常短（只有 5 个字），header 就显示 5 个字，感觉信息不足怎么办？答：这是 breadcrumb 设计的局限，但在实践中很罕见——用户会用自然语言描述问题，5 个字已经是可识别的片段（比如"性能优化"就足够让你想起上下文）。如果真的太短，可以增加"第一段最短 N 字才截断"的逻辑，但 Claude Code 没有这个，因为过度工程化收益边际递减。

**加分点**：提到 WeakMap 缓存（`promptTextCache`）的高效性——同一条消息在每次滚动时可能被 StickyTracker 多次查询，WeakMap 缓存保证 computeStickyPromptText 只运行一次，后续都是缓存命中。
