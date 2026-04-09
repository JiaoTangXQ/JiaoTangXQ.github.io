---
title: "getPromptForCommand 说明 skill 不是静态文本"
slug: "07-03-02-getpromptforcommand-skill"
date: 2026-04-09
topics: [扩展系统]
summary: "- `getPromptForCommand` 不只是把 Markdown 正文原样拿出来，它还会走参数替换、必要时执行 `executeShellCommandsInPrompt`，再把运行现场注入..."
importance: 1
---

# getPromptForCommand 说明 skill 不是静态文本

## 实现链
- `getPromptForCommand` 不只是把 Markdown 正文原样拿出来，它还会走参数替换、必要时执行 `executeShellCommandsInPrompt`，再把运行现场注入进去。
- 所以一条 skill 在真正被调用时，提示词是“现算”的：它会带上参数值、路径变量，甚至 shell 结果，而不是文件里那段原始静态文本。

## 普通做法
- 普通做法是把 prompt 当模板字符串，用户触发后仅做简单 `${arg}` 替换。
- 更省事一点的系统甚至完全不替换，直接把整份 Markdown 原样塞给模型。

## 为什么不用
- Claude Code 不满足于那种静态 prompt，因为很多技能要引用工作目录、插件根路径或运行时上下文，少了这些信息，模型拿到的只是一份失真说明书。
- 从代码看，它宁可把 prompt 生成做重，也不把“现场信息”全压给用户手动补。

## 代价
- 代价是 prompt 生成链更难调试，尤其 shell 执行和参数替换一多，复现也更麻烦。
- 但对真实工作流来说，这比交给用户每次手填上下文更稳，因为系统至少知道自己到底补了什么。
