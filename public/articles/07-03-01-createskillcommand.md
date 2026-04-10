---
title: "createSkillCommand：Markdown 文件是怎么被编译成运行时对象的？"
slug: "07-03-01-createskillcommand"
date: 2026-04-09
topics: [扩展系统]
summary: "createSkillCommand 把解析好的 frontmatter、正文内容、来源标签和基目录组装成 Command 对象。这是技能系统里的'编译'步骤——输入是磁盘文件，输出是命令注册表能处理的稳定对象。"
importance: 1
---

# createSkillCommand：Markdown 文件是怎么被编译成运行时对象的？

## 工程考古：为什么叫"编译"而不是"加载"？

`createSkillCommand` 这个函数在代码里的位置很有意思：它处于 `parseSkillFrontmatterFields` 之后、命令注册表之前。它不读文件，不访问网络，只接受已经解析好的参数，输出一个 `Command` 对象。

这种"接受原材料、输出稳定产物"的模式，在编译器领域通常叫做"代码生成"阶段。对技能系统来说，`createSkillCommand` 就是那个代码生成器。

---

## 函数签名：它需要什么，返回什么

```typescript
export function createSkillCommand({
  skillName, displayName, description, hasUserSpecifiedDescription,
  markdownContent, allowedTools, argumentHint, argumentNames,
  whenToUse, version, model, disableModelInvocation, userInvocable,
  source, baseDir, loadedFrom, hooks, executionContext, agent,
  paths, effort, shell,
}: {
  // ... 类型声明
}): Command
```

输入有 22 个参数，全部来自 `parseSkillFrontmatterFields` 的返回值加上几个调用方提供的上下文（`source`、`baseDir`、`loadedFrom`）。

输出是一个 `Command` 对象——它携带了运行时需要的一切：`name`、`description`、`loadedFrom`、`isHidden`、`getPromptForCommand`……

---

## 编译产物的关键字段

**loadedFrom 和 source**

这两个字段是技能的"身份证"，在整个系统里用于来源感知的地方都依赖它们：

```typescript
source,       // 'userSettings' | 'projectSettings' | 'policySettings' | 'bundled' | ...
loadedFrom: 'skills',  // 或 'plugin' | 'bundled' | 'mcp' | 'commands_DEPRECATED'
```

`loadedFrom` 在 `getPromptForCommand` 内部还有安全作用：

```typescript
// Security: MCP skills are remote and untrusted
if (loadedFrom !== 'mcp') {
  finalContent = await executeShellCommandsInPrompt(finalContent, ...)
}
```

同一个函数，`loadedFrom` 不同，行为就不同。这是翻译层留下的来源感知分支。

**isHidden**

```typescript
isHidden: !userInvocable,
```

`user-invocable: false` 的技能被设为隐藏，只对模型可见。这个字段在 UI 层决定是否在 `/` 补全列表里展示这个命令。

**skillRoot**

```typescript
skillRoot: baseDir,
```

`baseDir` 是技能文件所在目录，被存进 `skillRoot`。在 `getPromptForCommand` 里，它会被注入到 prompt 正文里：

```typescript
let finalContent = baseDir
  ? `Base directory for this skill: ${baseDir}\n\n${markdownContent}`
  : markdownContent
```

这样模型在执行技能时就知道"我的工作根目录在哪里"，可以用 Read/Grep 工具访问技能目录下的其他文件。

---

## getPromptForCommand 里的动态组装

这是编译产物里最复杂的部分——`getPromptForCommand` 是一个闭包，它捕获了 `markdownContent`、`baseDir`、`argumentNames`、`loadedFrom`、`shell` 等编译时参数，在运行时动态组装最终 prompt：

1. **基础内容**：`baseDir` 注入 + `markdownContent`
2. **变量替换**：`substituteArguments()` 把 `$ARGUMENTS` 等占位符替换成实际参数
3. **特殊变量**：`${CLAUDE_SKILL_DIR}` 替换成技能目录路径，`${CLAUDE_SESSION_ID}` 替换成当前会话 ID
4. **Shell 执行**（非 MCP）：`executeShellCommandsInPrompt()` 执行 `` !`cmd` `` 风格的内嵌 shell 命令

这个组装过程的输出会随调用时的上下文变化——相同的技能，在不同目录、不同参数、不同会话下，产出的 prompt 可能完全不同。这就是为什么技能不是"静态文本"。

---

## 编译时决策 vs 运行时决策

| 决策 | 时机 | 原因 |
|---|---|---|
| 技能名称 | 编译时 | 命令注册表在启动阶段就需要 |
| description | 编译时 | 帮助文本、补全显示 |
| allowedTools | 编译时 | 权限系统需要提前知道 |
| isHidden | 编译时 | UI 渲染需要 |
| prompt 内容 | 运行时 | 依赖调用时的参数和上下文 |
| shell 执行结果 | 运行时 | 依赖当前环境状态 |

编译时决策越多，运行时越稳定；运行时决策越多，灵活性越高但可预测性越低。`createSkillCommand` 把两者分得很清楚。

---

## 面试指导

**"设计一个可扩展系统时，如何处理动态内容和静态元数据的分离？"**

参考这个模式：把"系统需要提前理解的字段"（名称、描述、权限声明、可见性）在加载阶段解析成稳定对象；把"依赖运行时上下文的字段"（prompt 内容、参数替换结果）包装成延迟求值的函数。

`createSkillCommand` 的 `getPromptForCommand` 就是这个模式的具体实现：它是一个工厂函数，在编译时捕获所有稳定参数，在运行时用实际上下文生成最终内容。这比"每次调用时重新读文件、重新解析 frontmatter"高效得多，也比"把所有内容都在启动时完全展开"更灵活。
