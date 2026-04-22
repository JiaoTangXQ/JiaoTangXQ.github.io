---
title: "MCP prompts 和 MCP skills 看起来一样，但来源完全不同——为什么不合并？"
slug: "07-08-04-promptsskills"
date: 2026-04-09
topics: [扩展系统]
importance: 1
---

# MCP prompts 和 MCP skills 看起来一样，但来源完全不同——为什么不合并？

## 用户视角：两者都能当 slash command 用

从用户的使用体验看，MCP prompts 和 MCP skills 非常相似：
- 都出现在 `/` 补全列表里
- 都有名称和描述
- 都可以接受参数
- 都会触发一段提示词给模型

如果我是产品经理，第一反应会是："它们看起来一样，合并成一个概念！"

但代码里它们完全不同。

---

## Prompts：服务器直接提供的运行时模板

```typescript
// 连接后拉取：
const promptsResult: ListPromptsResult = await client.listPrompts()
```

`listPrompts` 返回的结果直接来自服务器。当用户触发一个 prompt 时，Claude Code 会调用 `client.getPrompt(name, args)` 从服务器获取填充好的模板内容。

关键特征：
- **内容在服务器**：prompt 的模板文本存在服务器上，不在 Claude Code 里
- **每次触发都要请求服务器**：不能完全本地缓存，因为 prompt 内容可能依赖服务器状态
- **不经过 frontmatter 解析**：服务器返回的是 MCP 协议格式，不是 Claude Code 的 frontmatter 格式
- **不纳入命令制度**：prompt 不是 `Command` 对象，不走 `getCommands` 的装配流水线

---

## Skills：翻译进本地命令制度的服务器能力

```typescript
// 通过 mcpSkillBuilders 翻译：
const { createSkillCommand, parseSkillFrontmatterFields } = getMCPSkillBuilders()
const command: Command = createSkillCommand({
  // ...服务器返回的 skill 定义
  loadedFrom: 'mcp',
  source: 'mcp',
})
```

MCP skills 是服务器发布的一种特殊格式的能力定义，Claude Code 把它们翻译成 `Command` 对象，纳入本地命令系统。

关键特征：
- **内容在本地**：一旦翻译成 `Command`，内容（frontmatter 字段、描述等）存在内存里
- **触发时不需要请求服务器**（对于 prompt 内容）：prompt 文本已经在翻译时被保存到 `markdownContent`
- **经过 frontmatter 解析**：`parseSkillFrontmatterFields` 处理描述、工具声明等元数据
- **纳入命令制度**：是 `Command` 对象，出现在 `getCommands` 的结果里，参与补全、帮助等

---

## 两者的差异对照

| | MCP Prompts | MCP Skills |
|---|---|---|
| 数据来源 | `listPrompts` 返回 | `fetchMcpSkillsForClient` 翻译 |
| 触发时交互 | `getPrompt` → 服务器 | 本地 `getPromptForCommand` |
| 是否是 Command 对象 | 否 | 是 |
| frontmatter 解析 | 否 | 是 |
| 缓存策略 | 随 `prompts/list_changed` 失效 | 随资源/技能变化失效 |
| `loadedFrom` | 无（不是 Command） | 'mcp' |
| shell 执行 | 不适用 | 禁止（security） |

---

## 为什么不合并？

合并会引入哪些问题？

**问题一：触发语义不同**

prompts 每次触发都可能调用服务器（获取最新状态），skills 触发只用本地内容。如果合并，触发路径必须分支——或者都去服务器（浪费），或者都用本地（prompts 失去实时性）。

**问题二：制度边界不同**

skills 作为 `Command` 对象，要参与权限检查（`meetsAvailabilityRequirement`）、启用状态检查（`isCommandEnabled`）、帮助文本生成。prompts 不参与这些。如果合并，要么 prompts 也要符合这些制度（server 实现者的额外负担），要么 skills 放弃这些制度优势。

**问题三：缓存失效链不同**

skills 的缓存失效连接在资源失效链里（资源 → prompts → skills）。prompts 有独立的失效链（`prompts/list_changed`）。合并后，失效逻辑会变得混乱。

---

## 血缘不分清，后面就会乱

Claude Code 在这里坚持了"血缘要清楚"的原则：两个看起来相似的东西，只要来源和生命周期不同，就应该是不同的概念，用不同的代码路径处理。

这增加了用户的学习成本（"为什么有 prompts 又有 skills？"），但换来了实现的清晰性和未来的可扩展性——各自的演进不会互相干扰。

---

## 面试指导

**"产品经理要你把两个相似的功能合并成一个，你怎么判断是否应该？"**

判断框架：

1. **来源是否相同？** 来源不同（一个来自服务器，一个来自本地翻译）→ 倾向于不合并
2. **触发语义是否相同？** 语义不同（一个实时请求服务器，一个本地执行）→ 倾向于不合并
3. **生命周期是否相同？** 不同（缓存失效链不同）→ 倾向于不合并
4. **合并后代码里需要多少分支？** 分支越多，合并的成本越高

如果三个"是否相同"的问题都是"不同"，合并通常只是把两套不同的概念强行套上同一个外壳。用户少学了一个词，但系统的实现变得更复杂、更脆弱。

**"统一对用户有利，分离对开发者有利"**——这是两个合理需求的真实张力，值得在面试中说出来。
