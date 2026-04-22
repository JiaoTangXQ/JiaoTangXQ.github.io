---
title: "面试题：getPromptForCommand 为什么返回 ContentBlockParam[] 而不是 string？"
slug: "03-06-01-getpromptforcommand"
date: 2026-04-09
topics: [输入与路由]
importance: 1
---

# 面试题：getPromptForCommand 为什么返回 ContentBlockParam[] 而不是 string？

## 类型定义

在 `types/command.ts` 里，`PromptCommand` 的接口是：

```typescript
export type PromptCommand = {
  type: 'prompt'
  // ...
  getPromptForCommand(
    args: string,
    context: ToolUseContext,
  ): Promise<ContentBlockParam[]>  // ← 不是 Promise<string>
}
```

`ContentBlockParam` 是 Anthropic SDK 里的类型，代表消息内容的一个块，可以是：

```typescript
type ContentBlockParam =
  | TextBlockParam          // { type: 'text', text: string }
  | ImageBlockParam         // { type: 'image', source: ... }
  | ToolUseBlockParam       // { type: 'tool_use', ... }
  | ToolResultBlockParam    // { type: 'tool_result', ... }
  | DocumentBlockParam      // { type: 'document', ... }
```

## 为什么不用字符串

**1. skill 可以包含图片**

一个 skill 的内容可以是「参考这张设计图，按相同风格实现」，其中「这张设计图」是一张图片，不是文本描述。如果 `getPromptForCommand` 返回 string，图片就必须被转换成文字描述，精度损失很大。

**2. 参数注入时保留结构**

`getPromptForCommand(args, context)` 接收用户传入的参数 `args`。如果技能内容是结构化的（比如一个 template 里有占位符），参数替换后的结果可以保持每个内容块独立，而不是把所有内容拼成一个大字符串再切。

**3. 调用点的消费方式**

```typescript
// getMessagesForPromptSlashCommand 里
const result = await command.getPromptForCommand(args, context)

// result 是 ContentBlockParam[]，可以和其他 block 组合
const mainMessageContent: ContentBlockParam[] =
  imageContentBlocks.length > 0 || precedingInputBlocks.length > 0
    ? [...imageContentBlocks, ...precedingInputBlocks, ...result]  // ← 直接 spread
    : result
```

技能内容、粘贴图片（`imageContentBlocks`）、前置内容块（`precedingInputBlocks`）可以直接 spread 组合，不需要先 join 成字符串再解析。

如果是字符串，这里就要写 `[...imageContentBlocks, { type: 'text', text: result }, ...precedingInputBlocks]`，还破坏了顺序。

## 调用链：skill 内容怎么变成 isMeta 消息

```typescript
// 1. getPromptForCommand 返回 ContentBlockParam[]
const result = await command.getPromptForCommand(args, context)

// 2. 和图片、前置内容合并
const mainMessageContent: ContentBlockParam[] = [
  ...imageContentBlocks,
  ...precedingInputBlocks,
  ...result
]

// 3. 打包成 isMeta 用户消息
createUserMessage({
  content: mainMessageContent,
  isMeta: true  // ← 对用户隐藏
})
```

最终 `ContentBlockParam[]` 作为 `content` 字段进入用户消息（Anthropic API 的 `UserMessageParam.content` 支持 `ContentBlockParam[]`），完整保留了多媒体结构。

## 与 local 命令的对比

`local` 命令的实现函数：

```typescript
type LocalCommandCall = (
  args: string,
  context: LocalJSXCommandContext,
) => Promise<LocalCommandResult>
```

`LocalCommandResult` 最终是 `text | compact | skip`，是字符串或内部状态对象。

这说明 `local` 命令只需要处理文本输出，不需要多媒体内容。`prompt` 命令需要能构造任意结构的会话内容，所以用 `ContentBlockParam[]`。

## 实践意义

对于想开发 skill 的用户，这个类型意味着：skill 不只是一个 Markdown 文件。在 `getPromptForCommand` 里，可以：

- 动态生成 prompt 内容（根据 `args` 和 `context` 构造不同内容）
- 包含图片块（比如从当前工作目录加载参考图）
- 根据当前环境（`context` 里的信息）调整指令内容

这是比「模板文件替换变量」强大得多的能力。

---

*面试指导：被问到「skill 系统的设计亮点」时，从「getPromptForCommand 返回 ContentBlockParam[] 而不是 string」切入，说明这允许 skill 包含多媒体内容、支持动态构造，比静态模板文件更灵活。这个类型选择体现了设计者对 Anthropic API 能力的充分利用。*
