---
title: "流式 tool_use 还没完成时，React key 从哪里来？deriveUUID 的前 24 位策略"
slug: "11-08-04-tool-useuuid"
date: 2026-04-09
topics: [终端界面]
summary: "streaming tool use 每次收到 input_json_delta 都会触发渲染更新，但 React 需要稳定的 key 来判断是不是同一棵子树。Claude Code 用 deriveUUID 从 content block ID 派生出稳定标识，避免正在生成的工具调用不断 remount。"
importance: 1
---

# 流式 tool_use 还没完成时，React key 从哪里来？deriveUUID 的前 24 位策略

这是一道把"流式状态"和"React reconciliation"绑在一起的面试题。

## 问题的来源

Anthropic API 在流式模式下发送工具调用时，`input_json_delta` 事件会把工具输入分批送来，每次 delta 都是一个增量 JSON 片段。在整个工具调用完成之前，`Messages.tsx` 里的 `streamingToolUses` 数组每次收到 delta 都会更新——但这个更新应该是"修改现有行"，而不是"删掉旧行，加入新行"。

如果 React key 每次都变，reconciler 就认为这是两个不同的组件实例，会销毁旧的，挂载新的。视觉上表现为工具调用行不停闪烁；状态上表现为展开状态、hover 状态在每次 delta 后都重置。

## streamingToolUses 的过滤逻辑

`Messages.tsx` 在把 streaming tool uses 转换成合成的 assistant 消息之前，先过滤掉已经进入正式状态的：

```typescript
const visibleStreamingToolUses = streamingToolUses.filter(s =>
  !inProgressToolUseIDs.has(s.contentBlock.id) &&
  !normalizedToolUseIDs.has(s.contentBlock.id)
)
```

过滤的目的是：如果一个 tool use 已经出现在 `normalizedMessages` 里（说明 API 层面已经确认），就不再从 `streamingToolUses` 里单独渲染它，避免重复显示。

## deriveUUID 的前 24 位策略

过滤之后，每个剩余的 streaming tool use 被包进一个合成的 assistant 消息，key 通过 `deriveUUID` 生成：

```typescript
const key = deriveUUID(s.contentBlock.id, 0)
```

`deriveUUID` 的实现很简单：取 content block ID（已经是 UUID 格式）的前 24 个字符，然后拼上内容块索引（这里固定是 0）格式化的后缀。

为什么是前 24 位？UUID 的格式是 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`，前 24 个字符包含了 8+4+4+4=20 个十六进制字符加 3 个连字符，已经有 2^80 的空间，对单个会话内的唯一性绰绰有余，而且截断操作是 O(1) 的纯字符串操作。

关键属性：**同一个 content block ID 每次调用 deriveUUID 得到相同的结果**。这保证了无论收到多少次 `input_json_delta`，同一个 streaming tool use 始终对应同一个 React key，reconciler 会复用同一棵子树。

## 为什么不直接用 contentBlock.id

可以直接用 `s.contentBlock.id` 作为 key，`deriveUUID` 只是在它基础上做了一个格式变换。这么做的原因是统一性：正式的 normalized 消息用 `uuid` 字段做 key，streaming 合成消息也应该看起来像一个有 uuid 的实体。前 24 位截断 + 索引后缀让两种来源的 key 在格式上一致，渲染层不需要分类讨论。

## 从 streaming 到 normalized 的过渡

一个容易忽略的边缘情况：streaming tool use 完成后，API 发来完整的 assistant 消息（含完整 input），`normalizeMessages` 把它变成正式的 `RenderableMessage`，这条消息有自己的 `uuid`。

这时 streaming 版本被过滤逻辑移除，normalized 版本被添加。React key 从 `deriveUUID(contentBlock.id, 0)` 换成了 `message.uuid`。这是一次 **key 切换**，会触发 unmount + remount——但这是有意为之的：streaming 状态的组件和正式状态的组件可能有不同的内部结构（展开项目更多），重新挂载是合理的。

## 面试指导

这道题考察三个点的交叉：React reconciliation 机制、流式 API 的状态过渡、稳定标识符的生成策略。

**核心论证**：key 的稳定性要求来自 React 的 reconciliation 规则（同 key = 复用实例，不同 key = 重新挂载）。在流式场景下，组件的数据在每次 delta 后都变，但实例不应该变，所以 key 必须从数据里一个不变的属性派生。content block ID 在整个 streaming 生命周期内不变，所以用它派生 key。

**进阶问题**：如果同一条 assistant 消息里有 3 个并发工具调用，每个都在 streaming，如何保证 3 个 key 互不冲突？答：`deriveUUID(contentBlock.id, blockIndex)` 中的 `blockIndex` 是索引参数，每个 content block 有不同的索引，加进去作为后缀就能保证唯一性。

**常见错误**：认为用 `Math.random()` 生成 key 然后存进 ref 也能解决问题。这样做会在每次组件卸载/重挂载时改变 key，而 streaming 期间父组件重渲的情况下，如果 ref 被重置，key 会发生变化。deriveUUID 的优点是确定性：给定相同的输入永远产生相同的 key，不依赖任何外部状态。
