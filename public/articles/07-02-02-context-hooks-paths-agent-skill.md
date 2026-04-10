---
title: "paths、hooks、executionContext：技能怎么声明自己的工作边界？"
slug: "07-02-02-context-hooks-paths-agent-skill"
date: 2026-04-09
topics: [扩展系统]
summary: >-
  一个技能通过 paths 限制作用范围、hooks 声明前后钩子、executionContext 指定 fork 模式、agent 指定子智能体。这些字段把"高手经验"编译成了系统可执行的约束。
importance: 1
---

# paths、hooks、executionContext：技能怎么声明自己的工作边界？

## 安全分析角度：一个技能能影响哪些文件？

一个随意的提示词模板没有边界。但 Claude Code 的技能有——通过 `paths` 字段声明作用域。

这不是装饰性配置。它在运行时被用来判断这个技能是否应该在当前工作目录下可见，以及是否应该限制文件操作的范围。

---

## paths：作用域收紧

```typescript
function parseSkillPaths(frontmatter: FrontmatterData): string[] | undefined {
  if (!frontmatter.paths) return undefined

  const patterns = splitPathInFrontmatter(frontmatter.paths)
    .map(pattern => {
      // ignore 库把 'path' 同时匹配路径本身和其子目录
      // 所以 /** 后缀是多余的，去掉
      return pattern.endsWith('/**') ? pattern.slice(0, -3) : pattern
    })
    .filter((p: string) => p.length > 0)

  // 如果所有模式都是 ** (匹配全部)，等同于没设限制
  if (patterns.length === 0 || patterns.every((p: string) => p === '**')) {
    return undefined
  }

  return patterns
}
```

`paths` 使用和 `.gitignore` 语法相同的 `ignore` 库来匹配。`**` 全匹配等同于不设限，会被丢弃。设了具体路径的技能，在不匹配的目录下工作时系统可以选择不展示它，或者给用户提示。

**典型使用场景：**
- 一个"前端代码审查"技能只在 `src/frontend/` 下才有意义
- 一个"数据库迁移"技能只应该在 `migrations/` 目录下操作
- 把这些约束编进技能本身，比靠作者在文档里说"请在正确目录使用"更可靠

---

## hooks：前后钩子声明

```typescript
function parseHooksFromFrontmatter(
  frontmatter: FrontmatterData,
  skillName: string,
): HooksSettings | undefined {
  if (!frontmatter.hooks) return undefined

  const result = HooksSchema().safeParse(frontmatter.hooks)
  if (!result.success) {
    logForDebugging(`Invalid hooks in skill '${skillName}': ${result.error.message}`)
    return undefined
  }

  return result.data
}
```

`HooksSchema()` 是 Zod schema，定义了 hooks 的合法格式。解析失败只记日志，不中断加载——这是对技能作者的防御性设计：写错了 hooks 不会导致整个技能无法加载，只是 hooks 会被静默跳过。

hooks 的典型用途是：技能执行前后自动运行某些操作（如更新日志、触发通知、修改配置）。声明在 frontmatter 里意味着系统在加载阶段就知道这个技能"有钩子"，可以提前注册处理逻辑。

---

## executionContext 和 agent：控制执行方式

```typescript
// 在 parseSkillFrontmatterFields 里
executionContext: frontmatter.context === 'fork' ? 'fork' : undefined,
agent: frontmatter.agent as string | undefined,
```

**fork 执行上下文**

`context: fork` 让这个技能在子 agent 里运行，而不是在当前会话上下文里直接执行。适合：
- 技能需要独立的工具调用序列
- 技能可能执行很久，不想阻塞主对话
- 技能有自己的权限边界，不应继承父会话的所有权限

**agent 字段**

指定调用哪个具体的 agent 实现来执行这个技能。不填则使用默认 agent。

---

## effort：资源声明

```typescript
const effortRaw = frontmatter['effort']
const effort = effortRaw !== undefined ? parseEffortValue(effortRaw) : undefined
```

`effort` 字段让技能作者可以声明"这个技能需要多少推理资源"。这是元数据前置的另一个例子：调度层在执行前就知道这个技能是重型任务还是轻量任务，可以做出更好的资源分配决策。

---

## 设计意图：把"高手经验"编译成约束

这套字段背后有一个统一的设计意图：把原本只存在于技能作者脑子里的"这个技能应该怎么用、在哪里用、用多少资源"，编译成系统能执行的约束和声明。

不声明 paths，技能就可能在错误目录下工作。不声明 hooks，外围制度就没法稳定介入。不声明 executionContext，调度层就不知道该不该 fork。

frontmatter 不是文档，是规范。

---

## 面试指导

**"如何在插件系统中实现权限控制？"**

一个层次高的回答会提到：权限控制可以分为两层——

1. **声明层**：插件/技能在元数据里声明自己的能力边界（需要哪些权限、能访问哪些路径）
2. **执行层**：系统在运行时根据声明做检查，而不是等到出错才发现越界

Claude Code 的 `paths` + `allowedTools` 组合就是这个模式：技能在 frontmatter 里声明作用范围，系统在装配阶段（而不是执行阶段）就能判断这个技能在当前上下文是否合法。

**提前声明 → 提前拒绝 → 最小惊讶原则**。这是比"运行时捕获异常"更好的权限控制设计。
