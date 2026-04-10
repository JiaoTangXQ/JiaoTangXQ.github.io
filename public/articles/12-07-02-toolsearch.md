---
title: "面试题：Chrome 工具为什么需要 ToolSearch 才能被模型发现？"
slug: "12-07-02-toolsearch"
date: 2026-04-09
topics: [外延执行]
summary: "Claude in Chrome 的工具不是直接在对话开始时就对模型可见，而是需要先通过 ToolSearch 加载。prompt.ts 里的 CHROME_TOOL_SEARCH_INSTRUCTIONS 明确规定了这个流程。这个设计涉及 MCP 工具数量增长时的上下文窗口管理问题。"
importance: 1
---

# 面试题：Chrome 工具为什么需要 ToolSearch 才能被模型发现？

## 工具太多时的问题

MCP 协议允许服务器暴露任意数量的工具。如果用户配置了多个 MCP server，每个 server 又有几十个工具，工具列表可能非常长。

把所有工具的完整定义（名称、描述、参数 schema）都放在每次请求的 context 里，有两个代价：

1. **Token 消耗**：工具定义占用的 tokens 不是"零成本"的，它们减少了可用于真正任务的上下文空间
2. **模型注意力**：工具太多时，模型可能无法有效关注最相关的工具

ToolSearch 解决的是这个问题：只在模型真正需要某个工具时，才把这个工具的完整定义加载进来。

## CHROME_TOOL_SEARCH_INSTRUCTIONS 的内容

`prompt.ts` 里定义了当 ToolSearch 启用时，如何使用 Chrome 工具的指令：

```ts
export const CHROME_TOOL_SEARCH_INSTRUCTIONS = `**IMPORTANT: Before using any chrome browser tools, you MUST first load them using ToolSearch.**

Chrome browser tools are MCP tools that require loading before use. Before calling any mcp__claude-in-chrome__* tool:
1. Use ToolSearch with \`select:mcp__claude-in-chrome__<tool_name>\` to load the specific tool
2. Then call the tool

For example, to get tab context:
1. First: ToolSearch with query "select:mcp__claude-in-chrome__tabs_context_mcp"
2. Then: Call mcp__claude-in-chrome__tabs_context_mcp`
```

这个指令告诉模型：Chrome 工具不是直接可用的，必须先通过 ToolSearch 的 `select:` 语法加载，然后才能调用。

## CLAUDE_IN_CHROME_SKILL_HINT 的作用

除了 ToolSearch 指令，还有一个更轻量的 skill hint：

```ts
export const CLAUDE_IN_CHROME_SKILL_HINT = `**Browser Automation**: Chrome browser tools are available via the "claude-in-chrome" skill. CRITICAL: Before using any mcp__claude-in-chrome__* tools, invoke the skill by calling the Skill tool with skill: "claude-in-chrome". The skill provides browser automation instructions and enables the tools.`
```

Skill 是一个更高层的抽象：调用一个 Skill 会把整套相关的系统提示词和工具定义一起加载进来，而不是逐个 ToolSearch。

对于 Claude in Chrome，调用 `Skill("claude-in-chrome")` 相当于：
1. 把 `BASE_CHROME_PROMPT` 加入 system prompt
2. 把所有 `mcp__claude-in-chrome__*` 工具定义加载进来

这是一种"按需加载整个能力包"的机制，而 ToolSearch 是"按需加载单个工具"的机制。

## 注入时机的差异

`getChromeSystemPrompt()` 返回的基础提示词在 `setupClaudeInChrome()` 时就注入，它在每次使用 Chrome 能力的会话里都存在。

但 `CHROME_TOOL_SEARCH_INSTRUCTIONS` 不是在 setup 时注入的，注释说明了：

```ts
/**
 * Get the base chrome system prompt (without tool search instructions).
 * Tool search instructions are injected separately at request time in claude.ts
 * based on the actual tool search enabled state.
 */
export function getChromeSystemPrompt(): string {
  return BASE_CHROME_PROMPT
}
```

ToolSearch 指令是在每次请求时根据 ToolSearch 是否启用来动态决定是否注入。这意味着：
- 如果 ToolSearch 未启用：Chrome 工具在常规工具列表里可见，不需要特殊加载步骤
- 如果 ToolSearch 启用：Chrome 工具需要通过 ToolSearch 加载，系统提示里会有对应指导

## 工具名一致性的价值在这里也体现出来

`CHROME_TOOL_SEARCH_INSTRUCTIONS` 里的 `select:mcp__claude-in-chrome__tabs_context_mcp` 和实际工具名完全一致。

如果工具名在不同地方有不同形式（比如 ToolSearch 里叫 `chrome_tabs`，实际调用时叫 `mcp__claude-in-chrome__tabs_context_mcp`），模型需要理解两套命名之间的映射，并在正确时机使用正确的名字。

统一命名让 ToolSearch 指令里的名字和实际工具名完全相同，模型不需要进行命名转换。

## 调试：为什么我的 Chrome 工具不在工具列表里？

如果用户发现 Chrome 工具在 ToolSearch 之前无法使用，或者 ToolSearch 找不到 Chrome 工具，可能的原因：

1. **ToolSearch 未启用**：如果 ToolSearch 功能未启用，Chrome 工具应该在正常工具列表里；如果它们也不在，可能是 MCP server 没有成功启动

2. **MCP server 启动失败**：`setupClaudeInChrome()` 里的 manifest 安装失败，导致 Chrome MCP server 没有被注册

3. **工具名不匹配**：调用的工具名和实际工具名不一致（ToolSearch 的 `select:` 语法要求精确匹配）

检查方式：
```sh
# 查看 Claude Code 的调试日志
export CLAUDE_CODE_DEBUG_MCP=1
claude --chrome "..."
```

## 面试考察点

这道题考察的是**大型工具集管理**和**按需加载策略**的设计。

当 Agent 可用工具数量增长到几百个时，如何管理工具发现和工具加载是一个真实的工程问题。ToolSearch 是一种解决方案，其他方案包括：
- 工具按类别分组，用户按类别启用
- 工具按使用频率排名，只展示最常用的
- 语义搜索：根据当前任务的自然语言描述，召回最相关的工具

每种方案都有不同的权衡。Claude Code 选择了 Skill（整包按需加载）和 ToolSearch（单个工具按需加载）的组合，允许不同场景下使用最合适的粒度。

