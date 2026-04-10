---
title: "安全分析：REMOTE_SAFE_COMMANDS 里有哪些命令？为什么这些命令是「安全的」？"
slug: "03-07-02-remote-safe-commands"
date: 2026-04-09
topics: [输入与路由]
summary: "远端模式下只有 REMOTE_SAFE_COMMANDS 里的命令是可见的。这不是「安全」和「不安全」的对立，而是「在远端有稳定语义」和「依赖本地环境前提」的区别。理解这个白名单的选择标准，比背诵名单内容更重要。"
importance: 1
---

# 安全分析：REMOTE_SAFE_COMMANDS 里有哪些命令？为什么这些命令是「安全的」？

## 白名单内容

```typescript
export const REMOTE_SAFE_COMMANDS: Set<Command> = new Set([
  session,    // 显示 QR code / URL
  exit,       // 退出 TUI
  clear,      // 清屏
  help,       // 显示帮助
  theme,      // 切换终端主题
  color,      // 切换 agent 颜色
  vim,        // 切换 vim 模式
  cost,       // 显示 session 费用
  usage,      // 显示使用信息
  copy,       // 复制最后一条消息
  btw,        // 快速备注
  feedback,   // 发送反馈
  plan,       // 计划模式切换
  keybindings, // 快捷键管理
  statusline,  // 状态栏切换
  stickers,    // 贴纸
  mobile,      // 移动端 QR code
])
```

17 个命令。整个 Claude Code 有 50+ 内建命令，远端模式只暴露其中约 1/3。

## 选择标准是什么

看这些命令的共同点：它们都「只影响本地 TUI 状态」，不依赖：

- **本地文件系统**：`/files`（列出追踪的文件）、`/diff`（显示 diff）需要读取文件，远端没有这个执行环境
- **本地 shell/git 环境**：`/commit`、`/branch` 需要 git 命令行工具
- **IDE 连接**：`/ide` 需要本地 IDE 扩展
- **本地 MCP 服务器**：某些命令通过 MCP 工具工作，远端没有对应的 MCP 客户端
- **本地 UI 组件**：`/config`（local-jsx 命令）需要渲染 Ink 面板，远端 TUI 环境不支持

进入白名单的命令，即使在「没有本地终端环境」的远端模式下，仍然有清晰的语义和可执行的实现。

## 两个使用场景

代码注释里说明了 `REMOTE_SAFE_COMMANDS` 在两个地方使用：

```typescript
/**
 * Used in two places:
 * 1. Pre-filtering commands in main.tsx before REPL renders
 *    (prevents race with CCR init)
 * 2. Preserving local-only commands in REPL's handleRemoteInit
 *    after CCR filters
 */
```

**场景 1：REPL 渲染前的预过滤**

在 `main.tsx` 里，进入远端模式时会预先过滤命令列表：

```typescript
// REPL.tsx 里
setLocalCommands(prev => prev.filter(cmd => remoteCommandSet.has(cmd.name) || REMOTE_SAFE_COMMANDS.has(cmd)))
```

这避免了一个竞态问题：REPL 先用本地命令列表渲染，然后等 CCR 初始化消息到来后再过滤。如果初始化消息慢，用户可能在短暂的窗口期看到不应该出现的本地命令，然后点击后报错。预过滤消除了这个窗口。

**场景 2：handleRemoteInit 之后的保留**

CCR 初始化消息到来后，系统会重置命令列表为远端允许的命令集。`REMOTE_SAFE_COMMANDS` 里的命令被保留，其他命令被移除。

## 「安全」的两种含义

注意 `REMOTE_SAFE_COMMANDS` 的「safe」不是指「不会产生副作用」或「不会执行危险操作」。

`/compact` 有相当大的副作用（重写消息历史），但它在 `BRIDGE_SAFE_COMMANDS` 里（不在 `REMOTE_SAFE_COMMANDS` 里）。

这里的「safe」是「在远端执行环境下语义稳定、不依赖缺失的本地环境前提」。

`/theme` 改变颜色主题，这是一个明确的本地 TUI 状态变更，在远端 REPL 里仍然有意义（终端仍然在本地运行，只是控制来源是远端）。

`/commit` 调用 git 提交，需要本地 git 环境，在远端模式下执行现场不存在——即使让用户看到 `/commit` 命令，点击也只会报错。提前过滤，是更好的用户体验。

## 与 BRIDGE_SAFE_COMMANDS 的交叉

不是所有 `REMOTE_SAFE_COMMANDS` 里的命令都在 `BRIDGE_SAFE_COMMANDS` 里，也不是反过来。这两个 Set 解决的是不同问题，下一篇（03-07-03）会详细展开。

---

*面试指导：被问到「你们的远端模式是怎么处理命令可见性的」时，重点说明「白名单」的选择标准——「不依赖本地执行环境前提」，而不是「不危险」。这个标准比「安全的命令」更精确，更能体现设计者对远端执行环境的清晰认识。*
