---
title: "安全分析：BRIDGE_SAFE_COMMANDS 和 REMOTE_SAFE_COMMANDS 解决的不是同一个问题"
slug: "03-07-03-bridge-safe-commands"
date: 2026-04-09
topics: [输入与路由]
summary: "REMOTE_SAFE_COMMANDS 问的是「远端 REPL 里该出现哪些命令」，BRIDGE_SAFE_COMMANDS 问的是「从 bridge 来的命令触发，会不会逼本地做出不合适的动作」。两个不同的问题，两套不同的答案。"
importance: 1
---

# 安全分析：BRIDGE_SAFE_COMMANDS 和 REMOTE_SAFE_COMMANDS 解决的不是同一个问题

## 两个 Set 的定义

```typescript
// 远端 REPL 可见命令
export const REMOTE_SAFE_COMMANDS: Set<Command> = new Set([
  session, exit, clear, help, theme, color, vim,
  cost, usage, copy, btw, feedback, plan,
  keybindings, statusline, stickers, mobile,
])

// Bridge 入口可以触发的命令
export const BRIDGE_SAFE_COMMANDS: Set<Command> = new Set(
  [
    compact,      // 压缩上下文
    clear,        // 清空 transcript
    cost,         // 显示费用
    summary,      // 总结对话
    releaseNotes, // 显示更新日志
    files,        // 列出追踪文件
  ].filter(...)
)
```

差异很明显：`REMOTE_SAFE_COMMANDS` 有 17 个命令，`BRIDGE_SAFE_COMMANDS` 只有 6 个（而且这 6 个只对 `local` 型命令有意义，因为 `prompt` 型默认安全，`local-jsx` 默认不安全）。

## 为什么 BRIDGE_SAFE_COMMANDS 只有 6 个

这要从 `isBridgeSafeCommand` 的逻辑说起：

```typescript
export function isBridgeSafeCommand(cmd: Command): boolean {
  if (cmd.type === 'local-jsx') return false   // 一律拦截
  if (cmd.type === 'prompt') return true        // 一律允许
  return BRIDGE_SAFE_COMMANDS.has(cmd)          // local: 看白名单
}
```

**`local-jsx` 命令一律拦截**

bridge 客户端（手机端、web 控制台）没有本地 Ink 终端 UI。`local-jsx` 命令的核心是渲染一个可交互的终端面板——在 bridge 客户端上，这个面板渲染到哪里？没有地方。触发 `local-jsx` 命令会弹出一个本地面板，但 bridge 客户端看不到，操作不了，最终卡在那里。拦截是正确的。

**`prompt` 命令一律允许**

`prompt` 命令把技能内容展开成文本，然后让主循环继续推理。bridge 客户端看到的是推理结果，不需要本地执行任何特殊操作。文本在哪里都是文本。

**`local` 命令需要显式白名单**

`local` 命令在本地执行，有些有终端 UI 副作用（比如 `/config` 改变本地设置并弹面板，但 config 是 local-jsx 不是 local，这里只看 local），有些没有。`BRIDGE_SAFE_COMMANDS` 列出了那些「确实只产生文本输出、没有本地 UI 副作用」的 local 命令。

## bridge 的问题和 remote 的问题不同

**REMOTE_SAFE_COMMANDS 的问题**：

「在远端模式下，哪些命令在用户界面里应该出现？」

这是一个 **可见性** 问题。远端 REPL 仍然在本地运行，只是控制来源是远端。有些命令依赖本地环境前提（git、文件系统），暴露这些命令会让用户点击后报错。

**BRIDGE_SAFE_COMMANDS 的问题**：

「当一条命令来自手机/web bridge，执行这条命令会不会在本地产生不合适的 UI 或副作用？」

这是一个 **副作用** 问题。bridge 客户端和本地终端物理上分离，bridge 触发的命令会在本地执行，但 bridge 用户看不到本地 UI。如果命令弹出一个本地面板，bridge 用户无从感知，本地终端出现一个「鬼」面板无法关闭。

## 两个不同场景的举例

**`/theme`（主题切换）**：

- 在 `REMOTE_SAFE_COMMANDS` 里：远端 REPL 可以显示这个命令，用户可以切换主题
- 不在 `BRIDGE_SAFE_COMMANDS` 里：`theme` 是 `local-jsx` 命令，bridge 来的主题切换会弹本地面板，被 `isBridgeSafeCommand` 的第一行直接拦截

**`/files`（列出追踪文件）**：

- 不在 `REMOTE_SAFE_COMMANDS` 里：远端 REPL 里这个命令不出现（它读取本地文件状态，远端模式下不应该暴露）
- 在 `BRIDGE_SAFE_COMMANDS` 里：如果 bridge 客户端发来 `/files` 命令，它是 `local` 型命令，只输出文本列表，没有 UI 副作用，可以执行然后把结果流回 bridge 客户端

同一个命令，在两个判断框架里的答案完全不同，因为这两个框架回答的不是同一个问题。

## 历史背景

代码注释里记录了 bridge 安全检查的来源：

```typescript
// PR #19134 blanket-blocked all slash commands from bridge inbound because
// `/model` from iOS was popping the local Ink picker.
```

`/model` 是一个 `local-jsx` 命令，会弹出一个模型选择面板。iOS 用户输入 `/model`，本地终端突然弹出一个面板，用户在手机上完全无法操作，面板就挂在那里。

这个 bug 触发了对所有 bridge slash 命令的全面封锁，然后通过 `BRIDGE_SAFE_COMMANDS` 和 `isBridgeSafeCommand` 逐步开放安全的命令。这个历史说明两件事：bridge 的安全边界是在真实 bug 的压力下建立的；`local-jsx` 的全面拦截是正确的默认策略。

---

*面试指导：被问到「你们的 bridge 安全是怎么设计的」时，用「三分法」来解释 `isBridgeSafeCommand`：prompt 类型默认安全，local-jsx 默认拦截，local 类型看显式白名单。这比直接说「有一个白名单」更清楚地展示了设计意图。*
