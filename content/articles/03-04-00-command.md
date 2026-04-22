---
title: "面试题：Claude Code 里有多少种命令来源？它们最后统一成什么？"
slug: "03-04-00-command"
date: 2026-04-09
topics: [输入与路由]
importance: 1.4
---

# 面试题：Claude Code 里有多少种命令来源？它们最后统一成什么？

## 命令来源的多样性

翻开 `commands.ts`，`loadAllCommands` 这样组装完整命令列表：

```typescript
const loadAllCommands = memoize(async (cwd: string): Promise<Command[]> => {
  const [
    { skillDirCommands, pluginSkills, bundledSkills, builtinPluginSkills },
    pluginCommands,
    workflowCommands,
  ] = await Promise.all([
    getSkills(cwd),
    getPluginCommands(),
    getWorkflowCommands ? getWorkflowCommands(cwd) : Promise.resolve([]),
  ])

  return [
    ...bundledSkills,         // 随 Claude Code 打包的内置 skills
    ...builtinPluginSkills,   // 内建插件提供的 skills
    ...skillDirCommands,      // ~/.claude/commands/ 目录里用户自定义的 skills
    ...workflowCommands,      // workflow 脚本生成的命令
    ...pluginCommands,        // 已安装插件带来的命令
    ...pluginSkills,          // 已安装插件带来的 skills
    ...COMMANDS(),            // 内建命令（clear、compact、config 等）
  ]
})
```

七种来源。加上 MCP（从 `AppState.mcp.commands` 独立管理），实际上是八种来源。

每种来源加载方式不同，存储位置不同，更新时机不同。但最终都返回 `Command[]`。

## Command 类型为什么是统一的语言

```typescript
export type Command = CommandBase & (PromptCommand | LocalCommand | LocalJSXCommand)
```

`CommandBase` 是所有命令共有的「身份证字段」：

```typescript
type CommandBase = {
  name: string
  description: string
  availability?: CommandAvailability[]
  isEnabled?: () => boolean
  isHidden?: boolean
  aliases?: string[]
  isMcp?: boolean
  argumentHint?: string
  whenToUse?: string
  version?: string
  disableModelInvocation?: boolean
  userInvocable?: boolean
  loadedFrom?: 'commands_DEPRECATED' | 'skills' | 'plugin' | 'managed' | 'bundled' | 'mcp'
  kind?: 'workflow'
  immediate?: boolean
  isSensitive?: boolean
  userFacingName?: () => string
}
```

不管一个命令来自哪里，它都得回答这些问题：叫什么名字、怎么描述、什么时候可用、要不要对用户隐藏、能不能让模型调用、从哪里加载的。

这套共同语言让系统可以在不知道具体来源的情况下做这些事：

- **补全列表排序**：按 `name`、`description` 排序，不需要区分来源
- **可见性过滤**：`isEnabled()` 和 `availability` 决定是否显示，统一处理
- **远端安全过滤**：`REMOTE_SAFE_COMMANDS.has(cmd)` 直接用 Set 过滤，不需要分来源判断
- **bridge 安全过滤**：`isBridgeSafeCommand(cmd)` 看 `cmd.type`，不看来源

## 统一的代价与收益

**代价**：抽象层更厚。最简单的内建命令（比如 `clear`）也必须符合这套完整的 `Command` schema，即使它只需要 `name`、`description`、`type: 'local'` 三个字段。

**收益**：每个新的命令来源只需要把自己的格式转成 `Command`，就能自动获得排序、过滤、显示、安全检查这整套基础设施。

这一章（03-04）要展开讲三件事：
1. `Command` 统一了哪些公共身份（03-04-01、03-04-02）
2. 统一之后，来源差异被保留在哪里（03-04-03）

理解这三件事，才能理解为什么 Claude Code 的命令系统可以同时接住八种来源，还能保持入口层的清晰。

---

*面试指导：被问到「Claude Code 的命令架构是怎么设计的」时，从「多种来源 → 统一 Command 类型 → 保留差异字段」这个三段论展开，比说「有内建命令也有插件命令」更能体现架构意识。*
