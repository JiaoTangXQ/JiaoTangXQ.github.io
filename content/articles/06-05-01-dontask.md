---
title: “dontAsk 是 fail-closed，不是免打扰：一个常见的认知错误”
slug: "06-05-01-dontask"
date: 2026-04-09
topics: [治理与权限]
importance: 1
---

# dontAsk 是 fail-closed，不是免打扰：一个常见的认知错误

“别问我”这个名字有误导性。很多人第一次接触 `dontAsk` 模式时，以为它是”别问我，直接做”——等同于自动授权所有操作。实际上它的语义是”别问我，如果没有预授权就拒绝”。

## 源码里的实际行为

在 `permissions.ts` 的运行时审批逻辑中，`dontAsk` 模式的处理：

```typescript
case 'dontAsk':
  return {
    behavior: 'ask',
    message: DONT_ASK_REJECT_MESSAGE,
    decisionReason: { type: 'mode', mode: 'dontAsk' },
  }
```

注意：返回的 `behavior` 是 `'ask'`，不是 `'allow'` 或 `'deny'`。这是因为权限结果类型的设计把”需要用户介入”统一归类为 `ask`，然后系统根据当前模式决定实际行为是弹窗还是自动拒绝。

`DONT_ASK_REJECT_MESSAGE` 是一条固定的拒绝消息。在 `dontAsk` 模式下，系统看到这个 `ask` 结果时，不会显示弹窗，而是直接把这条消息作为工具调用失败的原因返回给 Claude。

## fail-closed 和 fail-open 的区别

**fail-open（如果很多人想象的那样）**：
- 有 allow 规则？通过
- 有 deny 规则？拒绝
- 没有匹配规则？通过（默认允许）

**fail-closed（实际行为）**：
- 有 allow 规则？通过
- 有 deny 规则？拒绝
- 没有匹配规则？拒绝（不弹窗，直接拒）

这个区别在安全设计里至关重要。fail-open 系统意味着”我信任所有没被明确拒绝的操作”，fail-closed 系统意味着”我只信任被明确授权的操作”。

## 谁应该用 dontAsk 模式

`dontAsk` 的设计目标不是”减少打扰”，而是”在 headless 环境里实现确定性行为”。

典型使用场景：
1. **CI/CD pipeline**：只允许预定义的操作集（比如 `Bash(npm test)`、`Read`），其他操作直接拒绝。用 `dontAsk` 可以确保 pipeline 不会因为等待用户输入而挂起。
2. **自动化测试框架**：确保测试里的 Claude 调用行为完全可预测，不会因为权限弹窗而中断测试。
3. **受限制的 SDK 集成**：开发者精确控制允许的工具集，不希望 Claude 在运行时遇到意外情况时向用户寻求帮助。

## dontAsk vs bypassPermissions：关键区别

两者都不弹窗，但行为完全相反：

| 场景 | dontAsk | bypassPermissions |
|------|---------|-------------------|
| 有 allow 规则 | 通过 | 通过 |
| 有 deny 规则 | 拒绝 | 跳过 deny，直接通过 |
| 没有匹配规则 | 拒绝 | 通过 |

`bypassPermissions` 是”跳过所有权限检查”，而 `dontAsk` 是”不弹窗，但规则仍然有效”。

这意味着：
- `dontAsk` + 精心设计的 allow 规则集 = 安全的自动化
- `bypassPermissions` = 完全信任，适合本地开发调试

## shouldAvoidPermissionPrompts 的关联

`ToolPermissionContext` 里有一个相关字段：

```typescript
/** When true, permission prompts are auto-denied (e.g., background agents that can't show UI) */
shouldAvoidPermissionPrompts?: boolean
```

这个字段和 `dontAsk` 模式有相似的效果，但机制不同：`shouldAvoidPermissionPrompts` 是 context 层面的标志，用于 headless agent（比如后台运行的子 agent）；而 `dontAsk` 是模式层面的设置，由用户或 SDK 显式选择。

当 `shouldAvoidPermissionPrompts` 为 true 时，运行时权限系统会先走 hook，如果 hook 没有决定，就自动拒绝（而不是弹窗）。这和 `dontAsk` 的效果类似，但来源不同。

## 这道题考什么

这道题的核心陷阱就是名称误解。能主动说出”dontAsk 是 fail-closed”并且解释清楚 fail-closed 和 fail-open 区别的候选人，说明对系统的安全立场有正确认识。

更进一步，能区分 `dontAsk`、`bypassPermissions`、`shouldAvoidPermissionPrompts` 三者的语义和使用场景，说明对权限模型有系统性理解，而不是零散的知识点。
