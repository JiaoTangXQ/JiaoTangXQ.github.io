---
title: "面试题：Command 类型里最不起眼的几个字段，实际上在管什么？"
slug: "03-04-02-command"
date: 2026-04-09
topics: [输入与路由]
summary: "CommandBase 里有些字段看起来只是 UI 配置，实际上是运行时策略对象的组成部分。disableModelInvocation、userInvocable、whenToUse、immediate——每个字段都在管理一个具体的系统行为边界。"
importance: 1
---

# 面试题：Command 类型里最不起眼的几个字段，实际上在管什么？

## 代码考古

`CommandBase` 的完整定义里，有几个字段容易被当成「文档字段」忽略：

```typescript
type CommandBase = {
  name: string
  description: string
  disableModelInvocation?: boolean  // ← 这是什么意思？
  userInvocable?: boolean           // ← 和上面有什么区别？
  whenToUse?: string                // ← 只是帮助文本吗？
  immediate?: boolean               // ← 什么是 immediate？
  isSensitive?: boolean             // ← 影响哪里的显示？
  kind?: 'workflow'                 // ← badge 用的吗？
  ...
}
```

这些字段实际上都在影响运行时行为。

---

## `disableModelInvocation`：命令对模型是否可见

```typescript
// getSkillToolCommands — 决定哪些命令出现在 SkillTool 的技能列表里
const allCommands = await getCommands(cwd)
return allCommands.filter(
  cmd =>
    cmd.type === 'prompt' &&
    !cmd.disableModelInvocation &&   // ← 这里过滤
    cmd.source !== 'builtin' &&
    ...
)
```

`disableModelInvocation: true` 的命令，模型看不到，也不能主动调用。只有用户显式输入 `/command-name` 才能触发。

典型用场：一些实验性或敏感的 skills，不希望模型在推理过程中自主决定调用它们。

---

## `userInvocable`：用户能不能直接输入命令名触发

```typescript
// getMessagesForSlashCommand 里
if (command.userInvocable === false) {
  return {
    messages: [
      createUserMessage({ content: `/${commandName}` }),
      createUserMessage({
        content: `This skill can only be invoked by Claude, not directly by users. Ask Claude to use the "${commandName}" skill for you.`
      }),
    ],
    shouldQuery: false,
    command
  }
}
```

`userInvocable: false` 的命令，用户手动输入 `/command-name` 会看到一条提示：「这个 skill 只能由 Claude 调用，不能直接触发」。

`disableModelInvocation` 和 `userInvocable` 是互补的两面：
- 只有 `disableModelInvocation: true`：用户可以触发，模型不能自主调用
- 只有 `userInvocable: false`：模型可以调用，用户不能直接触发
- 两者都设：这个命令……要怎么被调用？（这种情况在实践中应该是配置错误）

---

## `whenToUse`：不只是文档，还影响技能搜索排序

```typescript
// getSlashCommandToolSkills — 决定哪些 skills 出现在 SkillTool 的列表里
return allCommands.filter(
  cmd =>
    cmd.type === 'prompt' &&
    cmd.source !== 'builtin' &&
    (cmd.hasUserSpecifiedDescription || cmd.whenToUse) &&   // ← 这里
    ...
)
```

没有 `description` 也没有 `whenToUse` 的 prompt 命令，不会出现在模型可以搜索的技能列表里。`whenToUse` 是「这个技能在什么场景下应该被使用」的说明，也是技能是否进入模型视野的门槛之一。

---

## `immediate`：命令是否绕过队列立即执行

```typescript
// local-jsx 命令的执行逻辑
setToolJSX({
  jsx,
  shouldHidePromptInput: true,
  showSpinner: false,
  isLocalJSXCommand: true,
  isImmediate: command.immediate === true,  // ← 这里
})
```

`immediate: true` 的命令在执行时设置 `isImmediate` 标记，这个标记让 `useQueueProcessor` 知道这条命令要绕过等待逻辑立即处理，不排队。用于某些需要快速响应的 UI 命令（比如某些临时面板）。

---

## `isSensitive`：参数在 transcript 里是否脱敏

```typescript
case 'local': {
  const displayArgs = command.isSensitive && args.trim() ? '***' : args
  const userMessage = createUserMessage({
    content: prepareUserContent({
      inputString: formatCommandInput(command, displayArgs),  // ← 用 *** 替代
      precedingInputBlocks
    })
  })
```

`isSensitive: true` 的命令，参数在 transcript 里显示为 `***`。真实参数仍然传给命令执行，但不出现在会话历史里，避免密钥或敏感配置被记录。

---

## `kind: 'workflow'`：只影响 UI badge

目前 `kind: 'workflow'` 在补全列表里给命令加一个 workflow badge，区分普通 skill 和 workflow 脚本命令。不影响执行逻辑。

---

## 一个命令的完整政策画像

把这些字段放在一起看，一条 `Command` 不只是「一个可执行的功能」，而是一份「运行时政策对象」：

```
名字 + 描述 → 用户界面
availability + isEnabled → 谁能用
disableModelInvocation + userInvocable → 谁能触发
isSensitive → 参数如何显示
immediate → 执行优先级
whenToUse → 模型知不知道它
```

这些字段共同描述了「这个命令在系统里该怎么被对待」，而不只是「这个命令是做什么的」。

---

*面试指导：被问到「Command 类型设计的亮点是什么」时，从「它是一份运行时政策对象」这个角度切入，举 userInvocable 和 disableModelInvocation 的互补关系，说明同一个东西的用户可见性和模型可见性是可以独立控制的，这比说「字段很完整」更有深度。*
