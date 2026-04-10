---
title: "面试题：为什么不同来源的命令要说同一种语言？用四套各说各话不行吗？"
slug: "03-04-01-command"
date: 2026-04-09
topics: [输入与路由]
summary: "内建命令一套结构、skills 一套、插件一套、MCP 一套——这种架构在小系统里没问题，但在 Claude Code 这种规模下，入口层会被迫维护四套显示逻辑、四套过滤规则、四套安全检查。Command 统一抽象解决的正是这个问题。"
importance: 1
---

# 面试题：为什么不同来源的命令要说同一种语言？用四套各说各话不行吗？

## 架构对比

**方案 A（各说各话）**：

```typescript
// 入口层需要这样写
function filterCommandsForRemoteMode(
  builtinCommands: BuiltinCommand[],
  skills: Skill[],
  pluginCommands: PluginCommand[],
  mcpCommands: McpCommand[],
) {
  const safeBuiltins = builtinCommands.filter(c => REMOTE_SAFE_BUILTINS.has(c))
  const safeSkills = skills.filter(s => s.allowedInRemote)
  const safePlugins = pluginCommands.filter(p => p.remoteEnabled && p.isActive)
  const safeMcp = mcpCommands.filter(m => m.remoteMode === 'allowed')
  return [...safeBuiltins, ...safeSkills, ...safePlugins, ...safeMcp]
}
```

每次加一种新的命令来源，所有的过滤函数都要改。

**方案 B（统一 Command）**：

```typescript
export function filterCommandsForRemoteMode(commands: Command[]): Command[] {
  return commands.filter(cmd => REMOTE_SAFE_COMMANDS.has(cmd))
}
```

一行代码，对所有来源有效，加新来源不需要修改。

## 统一语言解锁了什么

翻开 `commands.ts`，以下函数都接受 `Command[]` 而不关心来源：

**`hasCommand` / `findCommand` / `getCommand`**：
```typescript
export function findCommand(commandName: string, commands: Command[]): Command | undefined {
  return commands.find(_ =>
    _.name === commandName ||
    getCommandName(_) === commandName ||
    _.aliases?.includes(commandName)
  )
}
```

在 `processSlashCommand` 里调用时，`commands` 是所有来源混合后的列表。slash 命令解析器不需要知道 `/commit` 是内建命令还是 skill，只需要知道它在不在列表里。

**`meetsAvailabilityRequirement`**：
```typescript
export function meetsAvailabilityRequirement(cmd: Command): boolean {
  if (!cmd.availability) return true
  for (const a of cmd.availability) {
    switch (a) {
      case 'claude-ai': if (isClaudeAISubscriber()) return true; break
      case 'console': if (!isClaudeAISubscriber() && ...) return true; break
    }
  }
  return false
}
```

不管命令来自哪里，可用性检查用同一套逻辑。某个插件命令只对 `claude-ai` 订阅者可见，和内建命令只对 `console` 用户可见，共享同一套判断框架。

**`isBridgeSafeCommand`**：
```typescript
export function isBridgeSafeCommand(cmd: Command): boolean {
  if (cmd.type === 'local-jsx') return false
  if (cmd.type === 'prompt') return true
  return BRIDGE_SAFE_COMMANDS.has(cmd)
}
```

这个函数完全不看 `loadedFrom`，只看 `type`。一个 MCP skill（type 为 `prompt`）和一个内建 skill（同样 type 为 `prompt`），bridge 安全判断结果相同。

## 来源信息没有消失，只是被推后

统一成 `Command` 不意味着来源信息丢失。`loadedFrom` 字段记录着每个命令的来历：

```typescript
loadedFrom?: 'commands_DEPRECATED' | 'skills' | 'plugin' | 'managed' | 'bundled' | 'mcp'
```

遥测系统、调试工具、skill 搜索这些需要区分来源的功能，还是可以读这个字段。只是入口层的公共判断不需要关心它。

**来源的差异被推到了执行层**：`getMessagesForSlashCommand` 里的 `command.type` switch 才根据类型走不同路径，不是在统一身份的环节就分叉。

## 为什么说这是「好的抽象」

一个抽象的好坏，可以用「加新东西需要改多少地方」来衡量。

如果 Claude Code 之后又加了一种叫「Workflow」的命令来源（实际上它已经有了 `workflowCommands`），需要改什么？

- 在 `loadAllCommands` 里加 `...workflowCommands`：改 1 行
- `filterCommandsForRemoteMode`、`isBridgeSafeCommand`、`findCommand`：改 0 行

这就是统一抽象的价值：**新来源加入时，公共基础设施零修改**。

---

*面试指导：被问到「如何设计一个支持多种来源的命令系统」时，用「统一 schema + 延迟来源判断」来回答，比说「用接口/基类做抽象」更具体。举 isBridgeSafeCommand 只看 type 不看 loadedFrom 这个例子，能说明统一抽象在实际中是怎么工作的。*
