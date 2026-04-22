---
title: "技能的 frontmatter 解析链：parseSkillFrontmatterFields 拆了哪些字段？"
slug: "07-02-01-skill-frontmatter"
date: 2026-04-09
topics: [扩展系统]
importance: 1
---

# 技能的 frontmatter 解析链：parseSkillFrontmatterFields 拆了哪些字段？

## 插件架构分析：技能不是文本，是带制度字段的工作包

理解 Claude Code 技能系统的关键认知转变是：一份 `SKILL.md` 文件不等于一段提示词，它等于一个带有执行约束声明的工作包。

`parseSkillFrontmatterFields()` 是这套声明的解析器，它的返回值直接决定了一个技能能做什么、不能做什么。

---

## 源码：parseSkillFrontmatterFields 的完整签名

```typescript
export function parseSkillFrontmatterFields(
  frontmatter: FrontmatterData,
  markdownContent: string,
  resolvedName: string,
  descriptionFallbackLabel: 'Skill' | 'Custom command' = 'Skill',
): {
  displayName: string | undefined
  description: string
  hasUserSpecifiedDescription: boolean
  allowedTools: string[]
  argumentHint: string | undefined
  argumentNames: string[]
  whenToUse: string | undefined
  version: string | undefined
  model: ReturnType<typeof parseUserSpecifiedModel> | undefined
  disableModelInvocation: boolean
  userInvocable: boolean
  hooks: HooksSettings | undefined
  executionContext: 'fork' | undefined
  agent: string | undefined
  effort: EffortValue | undefined
  shell: FrontmatterShell | undefined
}
```

17 个返回字段——这不是在解析一段文本，而是在解析一份制度说明书。

---

## 关键字段逐一分析

**description / hasUserSpecifiedDescription**

```typescript
const validatedDescription = coerceDescriptionToString(frontmatter.description, resolvedName)
const description =
  validatedDescription ??
  extractDescriptionFromMarkdown(markdownContent, descriptionFallbackLabel)
```

有两级 fallback。作者显式填了 `description` 就用那个；没填就从 Markdown 正文第一行提取。`hasUserSpecifiedDescription` 标记区分这两种情况，影响后续是否允许这个技能在插件命令列表里出现（`getSkillToolCommands` 的过滤逻辑）。

**allowedTools**

```typescript
allowedTools: parseSlashCommandToolsFromFrontmatter(frontmatter['allowed-tools']),
```

控制这个技能能调用哪些工具。在 `getPromptForCommand` 里，shell 执行时会用这些工具名覆盖 `alwaysAllowRules.command`，实现"只允许白名单工具"的效果。

**userInvocable**

```typescript
const userInvocable =
  frontmatter['user-invocable'] === undefined
    ? true
    : parseBooleanFrontmatter(frontmatter['user-invocable'])
```

默认 `true`（用户可直接 `/skill-name` 调用）。设为 `false` 时，技能对用户隐藏（`isHidden: !userInvocable`），只对模型可见——适合纯内部工作流技能。

**model**

```typescript
const model =
  frontmatter.model === 'inherit'
    ? undefined
    : frontmatter.model
      ? parseUserSpecifiedModel(frontmatter.model as string)
      : undefined
```

允许技能声明自己想用哪个模型。`inherit` 显式继承当前会话模型（等同于不填）。不填默认也继承。只有填了具体模型 ID 才会覆盖。

**effort**

```typescript
const effortRaw = frontmatter['effort']
const effort = effortRaw !== undefined ? parseEffortValue(effortRaw) : undefined
if (effortRaw !== undefined && effort === undefined) {
  logForDebugging(`Skill ${resolvedName} has invalid effort...`)
}
```

控制这个技能使用多少"推理资源"。`parseEffortValue` 接受 `EFFORT_LEVELS` 里的枚举值或整数。如果填了但无效，只记日志不报错——这是对技能作者的容错设计。

**executionContext / agent / shell**

这三个字段控制技能的执行方式：
- `executionContext: 'fork'` → 让技能在子 agent 中运行
- `agent` → 指定具体 agent 名
- `shell` → 声明是否/如何执行 shell 命令

这些字段让技能不只是"一段文字"，而是"一种工作方式"。

---

## 为什么不在调用时才解析？

最自然的问题：为什么不等用户真正触发技能时再去读取这些字段？

答案藏在 `getSkillToolCommands` 里：

```typescript
export const getSkillToolCommands = memoize(
  async (cwd: string): Promise<Command[]> => {
    const allCommands = await getCommands(cwd)
    return allCommands.filter(
      cmd =>
        cmd.type === 'prompt' &&
        !cmd.disableModelInvocation &&
        cmd.source !== 'builtin' &&
        (cmd.loadedFrom === 'bundled' ||
          cmd.loadedFrom === 'skills' ||
          cmd.loadedFrom === 'commands_DEPRECATED' ||
          cmd.hasUserSpecifiedDescription ||
          cmd.whenToUse),
    )
  },
)
```

`getSkillToolCommands` 在启动阶段就要过滤可以暴露给模型的技能。它需要 `disableModelInvocation`、`hasUserSpecifiedDescription`、`whenToUse`——如果这些字段不提前解析好，这个过滤根本无法进行。

这是"编译期 vs 运行时"的经典权衡：把解析前移，启动有额外开销，但调用时可以直接使用已解析的对象，而不是现场扫描文件。

---

## 面试指导

**被问到"如何设计一个技能/插件的元数据系统"时：**

提到 frontmatter 作为声明式接口是一个好起点。但更深的问题是：哪些字段需要在发现阶段解析，哪些可以延迟到调用时？

Claude Code 的选择是：凡是影响发现、过滤、帮助文本、权限判断的字段，一律在加载阶段解析。只有 `getPromptForCommand` 的正文内容（参数替换、shell 执行）才延迟到调用时处理。

这个边界值得记住：**"让系统提前理解这个技能"的字段 → 前移解析；"运行时才知道的上下文" → 延迟处理。**
