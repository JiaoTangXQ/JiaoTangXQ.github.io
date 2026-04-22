---
title: "commands_DEPRECATED 还在代码里——生态迁移期的向后兼容策略"
slug: "07-04-01-skill-commands"
date: 2026-04-09
topics: [扩展系统]
importance: 1
---

# commands_DEPRECATED 还在代码里——生态迁移期的向后兼容策略

## 工程考古：一个 DEPRECATED 标记背后的决策

在 `loadSkillsDir.ts` 里，`LoadedFrom` 类型的定义如下：

```typescript
export type LoadedFrom =
  | 'commands_DEPRECATED'
  | 'skills'
  | 'plugin'
  | 'managed'
  | 'bundled'
  | 'mcp'
```

`commands_DEPRECATED` 这个枚举值有点不寻常——它明确标记了"这是过时的"，但并没有被删掉。代码里还保留着对它的完整处理逻辑。

这不是技术债务，而是有意识的迁移策略。

---

## 两套目录结构同时存在

Claude Code 支持两种技能目录：

**旧格式：`/commands/` 目录**

文件可以是任意 `.md` 文件，直接放在目录里，文件名就是命令名：

```
.claude/commands/
  review-code.md
  daily-standup.md
  nested/
    deploy.md
```

**新格式：`/skills/` 目录**

每个技能必须是一个子目录，子目录里放 `SKILL.md`：

```
.claude/skills/
  review-code/
    SKILL.md
    templates/
      review-template.md
  daily-standup/
    SKILL.md
```

新格式的优势：技能可以附带辅助文件（模板、脚本、数据），通过 `${CLAUDE_SKILL_DIR}` 和 `baseDir` 访问。旧格式不支持这一点。

---

## 两套加载器并行运行

`loadSkillsDir.ts` 里有两个独立的加载函数：

```typescript
// 新格式：/skills/ 目录
async function loadSkillsFromSkillsDir(
  basePath: string,
  source: SettingSource,
): Promise<SkillWithPath[]>

// 旧格式：/commands/ 目录
async function loadCommandsFromCommandsDir(
  basePath: string,
  source: SettingSource,
): Promise<SkillWithPath[]>
```

两者的主要区别在于命令名的派生方式：

```typescript
// 新格式命名：取父目录名（即技能目录名）
function getSkillCommandName(filePath: string, baseDir: string): string {
  const skillDirectory = dirname(filePath)       // .../skills/review-code/SKILL.md → .../skills/review-code
  const parentOfSkillDir = dirname(skillDirectory) // → .../skills
  const commandBaseName = basename(skillDirectory) // → review-code
  const namespace = buildNamespace(parentOfSkillDir, baseDir)
  return namespace ? `${namespace}:${commandBaseName}` : commandBaseName
}

// 旧格式命名：取文件名（去掉 .md）
function getRegularCommandName(filePath: string, baseDir: string): string {
  const fileName = basename(filePath)
  const commandBaseName = fileName.replace(/\.md$/, '')
  // ...
}
```

---

## getSkillToolCommands 的兼容处理

```typescript
return allCommands.filter(
  cmd =>
    cmd.type === 'prompt' &&
    !cmd.disableModelInvocation &&
    cmd.source !== 'builtin' &&
    (cmd.loadedFrom === 'bundled' ||
      cmd.loadedFrom === 'skills' ||
      cmd.loadedFrom === 'commands_DEPRECATED' ||  // 旧格式也要暴露给模型
      cmd.hasUserSpecifiedDescription ||
      cmd.whenToUse),
)
```

旧格式的技能（`commands_DEPRECATED`）和新格式的技能（`skills`）都能暴露给模型，不需要用户修改任何东西。这是向后兼容的核心——用户可以继续使用旧目录，系统会正确处理。

---

## 迁移桥的代价

这种"新旧并存"的策略有两个明显代价：

**代价一：装配层变脏**

`getSkillDirCommands` 需要同时处理两种来源、两种命名规则、两种目录结构。代码里有额外的分支来处理旧格式的 `transformSkillFiles`（处理 `SKILL.md` 在旧目录里的特殊行为）。

**代价二：重命名冲突风险**

如果用户同时有 `.claude/commands/review-code.md` 和 `.claude/skills/review-code/SKILL.md`，会发生名字冲突。`loadSkillsDir.ts` 通过 `realpath` 去重来处理这种情况（后文详述），但冲突检测本身就是额外的复杂度。

---

## 为什么不直接废掉旧格式？

原因很现实：

1. **存量用户**：有人已经在 `~/.claude/commands/` 里放了几十个自定义命令
2. **文档惯性**：旧格式在教程和博文里还有大量引用
3. **迁移成本不对称**：硬切对新用户没有好处（他们本来就用新格式），只对老用户有坏处

这是一个典型的"新功能不应该破坏旧工作流"原则的实践。`DEPRECATED` 标记是对开发者的提示（"这个路径最终会消失"），而不是对用户的立即影响。

---

## 面试指导

**"你是如何处理 API/接口的向后兼容性的？"**

这道题的一个好答案模式：

1. 新旧并存 + 明确标记（如 `_DEPRECATED` 后缀）
2. 新系统完全覆盖旧系统的能力（新格式 `/skills/` 支持旧格式 `/commands/` 的所有用途）
3. 迁移路径清晰（用户可以逐步把旧文件移到新目录）
4. 废弃时间轴透明（`DEPRECATED` 标记说明这会消失，但不说明何时）

不要说"立即删掉旧格式，要求用户迁移"——除非有非常强的理由（安全漏洞、根本性设计缺陷），否则这种做法会伤害真实用户。
