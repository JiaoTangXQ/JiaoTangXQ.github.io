---
title: "为什么 tmux/iTerm2 后端探测结果要被缓存？稳态优先于动态最优的设计取舍"
slug: "09-07-04-tmuxiterm2"
date: 2026-04-09
topics: [多Agent协作]
importance: 1
---

# 为什么 tmux/iTerm2 后端探测结果要被缓存？稳态优先于动态最优的设计取舍

`registry.ts` 里有这样一段逻辑：

```typescript
let cachedDetectionResult: PaneBackend | null = null

export async function detectAndGetBackend(): Promise<PaneBackend> {
  // 如果已经探测过，直接返回缓存结果
  if (cachedDetectionResult) return cachedDetectionResult
  
  // 按优先级探测
  // tmux → iTerm2 → 外部 tmux
  
  cachedDetectionResult = selectedBackend
  return cachedDetectionResult
}
```

一旦探测出后端，结果被缓存，后续所有 `detectAndGetBackend()` 调用都返回缓存值，不重新探测环境。

这看起来是一个微小的实现细节，但它背后有一个明确的设计决策。

## 不缓存会有什么效果

如果每次调用 `detectAndGetBackend()` 都重新探测：

- 第一个 teammate 启动时：检测到 tmux 可用，用 tmux 创建 pane，边框是蓝色，标题是 "researcher"。
- 用户这时候打开了 iTerm2 窗口，关闭了 tmux 会话。
- 第二个 teammate 启动时：重新检测，tmux 不可用了，切换到 iTerm2，在一个完全不同的窗口里创建新 pane。

结果：researcher 在 tmux pane 里，reviewer 在 iTerm2 标签页里，两个 teammate 在两个不同的界面空间里。用户的 tmux 布局失效了，因为少了一个成员；iTerm2 里只有一个 pane，没有 leader。

这不是"使用了更好的后端"，这是"团队空间碎裂了"。

## 什么是"团队空间语义"

当 Claude Code 用 tmux 创建团队时，它建立了一套空间语义：

- 领导者在 tmux 左侧某个 pane
- 所有 teammate 在同一个 tmux window 里的右侧
- 颜色编码和 pane 位置形成稳定的视觉映射

这套空间语义是用户理解"团队在哪里工作"的心智模型的基础。一旦某个 teammate 用了不同的后端（比如切到了 iTerm2），这套语义就不再统一：你的空间记忆里"tmux 右侧"是团队工作区，但现在有个成员跑到了 iTerm2 里，在完全不同的维度上工作。

缓存探测结果，是为了保证**整个会话里所有 teammate 都说同一种"空间语言"**。

## 探测的优先级顺序

```
1. 是否在 tmux 里运行（$TMUX 环境变量）→ 用 TmuxBackend
2. 是否在 iTerm2 里运行（$TERM_PROGRAM=iTerm.app）→ 用 ITermBackend
3. tmux 是否可用（which tmux）→ 创建外部 tmux session 用 TmuxBackend
```

优先级的逻辑是：**用户已经在用的环境 > 用户可用的环境**。

如果用户在 tmux 里运行 Claude Code，最自然的是在同一个 tmux session 里管理 teammate，而不是再打开 iTerm2。用户已经在 tmux 里了，colleague pane 应该在 tmux 里。

如果用户在 iTerm2 终端里（不在 tmux），用 iTerm2 的 tab/pane 来展示 teammate 最自然，因为用户的工作环境就在 iTerm2 里。

## 启动时快照 vs 运行时探测

`teammateModeSnapshot.ts` 采用了同样的快照策略：

```typescript
// 在进程启动时捕获模式
let capturedTeammateMode: TeammateMode | undefined

export function captureTeammateModeSnapshot(mode: TeammateMode): void {
  capturedTeammateMode = mode
}

export function getTeammateModeFromSnapshot(): TeammateMode | undefined {
  return capturedTeammateMode
}
```

`teammateMode` 在进程启动时被记录，之后的所有查询都从这个快照读取，不重新计算。

为什么？因为 `teammateMode` 影响 UI 显示（显示哪些菜单选项）、功能可用性（哪些命令可以执行）、团队配置（如何生成系统提示）。如果这个值在会话中途改变，所有依赖它的组件都需要重新处理，而且行为变化对用户来说是不可预期的。

快照策略的核心主张：**某些决定一旦做出，在当次会话里就不应该改变**，因为改变的成本（系统状态不一致、用户体验割裂）高于保持稳态的成本（偶尔无法使用最新的最优配置）。

## 稳态思维 vs 动态最优思维

两种系统设计哲学的对比：

**动态最优**：实时探测环境，始终使用当前最优的配置。如果有更好的后端变得可用，立刻切换。这在单 agent 场景里合理——每次调用相互独立，切换后端不影响之前的状态。

**稳态优先**：一旦做出初始决策，在整个会话里保持稳定。即使有更好的配置变得可用，也不切换，除非重启会话。这在多 agent 场景里更合理——因为多个 agent 共享同一套"团队空间"，任何单点的配置变化都会影响全局一致性。

Claude Code 的 pane backend 缓存是稳态思维的直接应用：牺牲一点"总是使用最优后端"的灵活性，换取"团队空间在整个会话里保持一致"的稳定性。

## 面试怎么答

如果面试题是"系统的配置/后端选择应该是静态的还是动态的"：

**区分场景**：单次调用相互独立的系统（无状态 API、函数计算）适合动态最优。多个操作共享状态的系统（团队协作、分布式事务）适合稳态优先。

**成本分析**：动态切换的成本 = 一致性保证的成本。在简单系统里，这个成本可以接受；在多 agent 协作这样的复杂系统里，保证所有 agent 的一致性视角可能比使用最优后端更重要。

**实践建议**：系统启动时做一次探测，把结果作为会话级的"基准配置"，整个会话不变。如果需要改变配置，提供显式的"重启会话"机制，而不是让配置在会话中途悄悄变化。用户知道"重启后配置才生效"，比"不知道什么时候配置会改变"的体验要好。
