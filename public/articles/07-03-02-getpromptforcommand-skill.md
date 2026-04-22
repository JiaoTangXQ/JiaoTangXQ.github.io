---
title: "getPromptForCommand 执行链：一个技能的 prompt 是怎么'现算'出来的？"
slug: "07-03-02-getpromptforcommand-skill"
date: 2026-04-09
topics: [扩展系统]
importance: 1
---

# getPromptForCommand 执行链：一个技能的 prompt 是怎么"现算"出来的？

## 面试题：提示词模板系统有哪些设计层次？

最简单的模板系统：字符串替换，`${name}` → `value`。

中等层次：支持条件分支和循环。

高层次：模板本身可以触发副作用（执行命令、读取文件），输出依赖运行时状态。

Claude Code 技能的 `getPromptForCommand` 属于最后一层。

---

## 完整执行链

```typescript
async getPromptForCommand(args, toolUseContext) {
  // 步骤 1：注入基础目录
  let finalContent = baseDir
    ? `Base directory for this skill: ${baseDir}\n\n${markdownContent}`
    : markdownContent

  // 步骤 2：参数替换
  finalContent = substituteArguments(finalContent, args, true, argumentNames)

  // 步骤 3：特殊变量展开
  if (baseDir) {
    const skillDir =
      process.platform === 'win32' ? baseDir.replace(/\\/g, '/') : baseDir
    finalContent = finalContent.replace(/\$\{CLAUDE_SKILL_DIR\}/g, skillDir)
  }
  finalContent = finalContent.replace(
    /\$\{CLAUDE_SESSION_ID\}/g,
    getSessionId(),
  )

  // 步骤 4：Shell 命令执行（仅限非 MCP 来源）
  if (loadedFrom !== 'mcp') {
    finalContent = await executeShellCommandsInPrompt(
      finalContent,
      {
        ...toolUseContext,
        getAppState() {
          const appState = toolUseContext.getAppState()
          return {
            ...appState,
            toolPermissionContext: {
              ...appState.toolPermissionContext,
              alwaysAllowRules: {
                ...appState.toolPermissionContext.alwaysAllowRules,
                command: allowedTools,  // 用技能声明的工具白名单覆盖
              },
            },
          }
        },
      },
      `/${skillName}`,
      shell,
    )
  }

  return [{ type: 'text', text: finalContent }]
},
```

---

## 步骤一：baseDir 注入

如果技能有 `baseDir`（即技能文件所在目录），会在正文前面加一行：

```
Base directory for this skill: /Users/alice/.claude/skills/my-skill
```

这让模型知道"我的工作目录在哪里"，可以用 `Read` 或 `Grep` 工具访问技能目录里的其他辅助文件（比如配置模板、示例文件）。

---

## 步骤二：参数替换

`substituteArguments` 处理两种占位符：

- `$ARGUMENTS`：把调用时传入的整个参数字符串注入进来
- 具名参数（如 `$FILE_PATH`）：如果 frontmatter 里声明了 `arguments: [FILE_PATH]`，就按位置替换

这让技能变成了可接受参数的"函数"，而不是固定的文本。

---

## 步骤三：特殊变量

**`${CLAUDE_SKILL_DIR}`**

等同于 `baseDir`，但语义更明确。在 Windows 上还会把反斜杠转成正斜杠，避免 shell 命令把它们当转义符处理。

**`${CLAUDE_SESSION_ID}`**

当前会话 ID。适合技能需要在多次调用间保持某种状态时用作标识符（如日志文件名、缓存键）。

---

## 步骤四：Shell 命令执行

这是整个链里最有力、也最危险的部分。技能正文里可以写 `` !`shell command` `` 语法，`executeShellCommandsInPrompt` 会在调用时真正执行这些命令，并把输出内嵌回 prompt。

典型用途：
```markdown
当前 git 状态：
!`git status --short`

最近 5 次提交：
!`git log --oneline -5`
```

模型收到的 prompt 会包含这些命令的真实输出，而不是命令本身。

**为什么 MCP 来的技能禁止这一步？**

```typescript
// Security: MCP skills are remote and untrusted — never execute inline
// shell commands (!`…` / ```! … ```) from their markdown body.
if (loadedFrom !== 'mcp') {
  finalContent = await executeShellCommandsInPrompt(...)
}
```

本地技能（`loadedFrom: 'skills'`）是用户自己写的，可以信任。MCP 技能来自远端服务器，属于不受信任的来源——如果允许它们执行任意 shell 命令，等于给远端服务器在本地机器上执行代码的能力。这个安全边界是硬编码的。

---

## allowedTools 的覆盖逻辑

Shell 执行时，`alwaysAllowRules.command` 会被技能声明的 `allowedTools` 覆盖：

```typescript
alwaysAllowRules: {
  ...appState.toolPermissionContext.alwaysAllowRules,
  command: allowedTools,
},
```

这实现了"技能白名单"语义：`allowed-tools` 字段不只是描述性的，它在 shell 执行时真的改变了工具调用的权限规则。

---

## 面试指导

**"模板引擎如何处理副作用？"**

大多数模板引擎故意不允许副作用（如 Jinja2、Handlebars 的纯函数哲学）。Claude Code 的技能系统走了相反的路：允许 shell 副作用，但通过来源检查（`loadedFrom !== 'mcp'`）和工具白名单（`allowedTools`）把副作用控制在可接受的范围内。

这是"信任边界"设计的典型案例：不是禁止所有副作用，而是只允许来自可信来源、在声明范围内的副作用。

**被问到"如何防止提示词注入"时**，可以提到这个模式：把来源标记（`loadedFrom`）嵌入对象本身，在执行层根据来源决定是否允许高权限操作。比在调用方做来源判断更可靠，因为对象本身携带了自己的信任级别。
