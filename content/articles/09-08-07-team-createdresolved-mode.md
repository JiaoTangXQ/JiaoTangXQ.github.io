---
title: "team_created 事件为什么上报 resolved mode 而不是配置的 mode？"
slug: "09-08-07-team-createdresolved-mode"
date: 2026-04-09
topics: [多Agent协作]
importance: 1
---

# team_created 事件为什么上报 resolved mode 而不是配置的 mode？

在 Claude Code 里，每当一个新的多 agent 团队被创建时，系统会发出一个 `team_created` 分析事件。事件里有一个字段记录了使用的 teammate 模式。

这个字段的值不是用户在配置里写的 `teammateMode`（比如 `'auto'`），而是 `getResolvedTeammateMode()` 的返回值。

```typescript
// 团队创建时上报分析事件
telemetry.track('team_created', {
  teamName: config.teamName,
  memberCount: config.members.length,
  teammateMode: getResolvedTeammateMode(),  // 解析后的实际模式，不是原始配置
  // ...
})
```

为什么要专门写一个 `getResolvedTeammateMode()` 而不是直接用 `config.teammateMode`？

## auto 模式是一个元值

`teammateMode` 有四个可能的值：`'tmux'`、`'iterm2'`、`'in-process'`、`'auto'`。

前三个是具体的执行后端选择，第四个是一个**元值**：不是选择，而是"让系统自动选择"的指令。

当用户配置 `auto` 时，实际使用的后端是什么？取决于运行时环境：
- 如果在 tmux 会话里 → 使用 `tmux` 后端
- 如果在 iTerm2 里且有 it2 工具 → 使用 `iterm2` 后端
- 其他情况 → 使用 `in-process` 后端

`getResolvedTeammateMode()` 的工作是：**把 `auto` 解析成实际选择**。它查询 `cachedDetectionResult`（探测结果），返回实际使用的后端类型字符串。

```typescript
export function getResolvedTeammateMode(): string {
  const snapshot = getTeammateModeFromSnapshot()
  
  if (snapshot !== 'auto') {
    return snapshot ?? 'unknown'  // 显式配置，直接返回
  }
  
  // auto 模式：看探测结果
  const detected = cachedDetectionResult
  if (!detected) return 'auto-unresolved'
  
  return detected.backendType  // 'tmux' | 'iterm2' | 'in-process'
}
```

## 分析系统关心"发生了什么"

分析（telemetry）系统的价值在于理解用户的真实行为和系统的真实性能。

如果上报的是原始配置值 `'auto'`，分析数据会告诉你：
- "80% 的用户用 auto 模式"

这个数据没什么用。你无法知道：
- 用了 auto 模式的用户，实际上跑了什么后端？
- tmux 后端在这些用户里工作得怎么样？
- in-process 模式在什么环境下成为了 fallback？

如果上报的是解析后的实际值，分析数据会告诉你：
- "70% 的用户实际用了 tmux，20% 用了 in-process（大多是 auto 模式的 fallback），10% 用了 iterm2"
- "in-process 模式的会话平均时长比 tmux 短 30%"（可能表明 in-process 体验更差，用户更快放弃）
- "pane 创建失败率：tmux 后端 2%，iterm2 后端 8%"

**分析系统的价值来自现实数据，不是意图数据**。用户的配置意图（`'auto'`）是意图，实际使用的后端是现实。

## 同样的原则适用于其他地方

这个"上报解析后的值"的原则不只出现在 `team_created` 事件里。

任何时候系统做了"意图 → 现实"的翻译，分析事件都应该上报翻译后的值：

- 用户配置了 `model: 'latest'`，实际用了 `claude-opus-4-5`；错误上报里应该记录 `claude-opus-4-5`，不是 `'latest'`
- 用户配置了 `maxTokens: 'auto'`，系统根据上下文长度选了 `8192`；性能事件里应该记录 `8192`，不是 `'auto'`
- 用户没有指定编码，系统检测到文件是 UTF-8；文件写入事件里应该记录 `'utf-8'`，不是 `undefined`

**把意图和现实区分开，是分析系统设计里的基本卫生原则**。混淆两者会让分析数据变成一堆无法解读的"auto"、"default"、"inherit"，而不是实际发生的事情。

## 上报时机的选择

`team_created` 事件在团队创建时发出，不是在每个 teammate spawn 时发出。

这个时机选择隐含了：在团队创建时，resolved mode 就应该是已知的。因为 `detectAndGetBackend()` 在 `getTeammateExecutor()` 被调用前就已经执行，`cachedDetectionResult` 已经有值。

如果在团队创建时 `cachedDetectionResult` 还是 null（`auto` 模式还没有解析），上报 `'auto-unresolved'` 比上报 `'auto'` 更诚实——前者明确表示"这个字段的值还不确定"，后者让分析端无法区分"用户配置了 auto"和"系统还没有解析"。

`'auto-unresolved'` 是一个防御性的 sentinel 值：如果分析数据里看到它，说明代码路径有问题——团队在 backend 探测完成之前被创建了。

## 面试怎么答

如果面试题是"在分析系统里，如何处理配置值和实际运行值的差异"：

**核心问题**：配置值表达意图（用户想要什么），运行值表达现实（系统实际做了什么）。分析系统应该主要记录现实，因为：
1. 现实值可以用来诊断问题（"auto 模式总是 fallback 到 in-process，说明 tmux 探测有问题"）
2. 现实值可以用来衡量性能（"tmux 后端的 spawn 时间比 in-process 快多少"）
3. 现实值可以用来发现用户行为（"哪些环境下 in-process 是最终使用的后端"）

**设计建议**：
1. 为每个"意图字段"设计对应的"解析函数"（如 `getResolvedTeammateMode()`），在分析上报时调用解析函数
2. 如果解析还没发生，上报一个明确的 sentinel 值（如 `'auto-unresolved'`），不要上报原始意图值
3. 同时上报意图值和现实值，可以在分析时做对比（比如"配置 auto 的用户中，有多少最终用了 in-process"）

**一句话原则**：分析系统是审计日志，记录发生了什么；配置系统是指令，记录想要什么。两者都有价值，但不要混在一个字段里。
