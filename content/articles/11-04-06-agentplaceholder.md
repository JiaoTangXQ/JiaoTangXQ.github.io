---
title: "看着某个 agent 时 placeholder 会直接改口，说明输入框先服从当前对话对象"
slug: "11-04-06-agentplaceholder"
date: 2026-04-09
topics: [终端界面]
summary: "当用户正在看某个 teammate，输入框占位词不会再说泛泛的“输入点什么”，而是直接改成“`Message @名字…`”。这很像真人团队里先转身再开口的动作。系统先承认你现在是在对谁说话，再把文本输..."
importance: 1
---

# 看着某个 agent 时 placeholder 会直接改口，说明输入框先服从当前对话对象

当用户正在看某个 teammate，输入框占位词不会再说泛泛的“输入点什么”，而是直接改成“`Message @名字…`”。这很像真人团队里先转身再开口的动作。系统先承认你现在是在对谁说话，再把文本输入这件事交给你。

这里还有一层很成熟的小克制。名字过长会先被截短，避免一整条 placeholder 被身份信息拖坏。也就是说，驾驶舱既要把对话关系说清楚，又不让这种说明反过来破坏操纵面的稳定。

## 实现链

`usePromptInputPlaceholder()` 先看 `viewingAgentName`，命中就直接生成 `Message @name…`，名字太长还会先截断。placeholder 不是固定文案，而是当前对话对象的一次翻译。

## 普通做法

更普通的 placeholder 会永远写着同一句通用提示，比如“输入消息”或“Ask anything”。

## 为什么不用

Claude Code 不保留那种通用口吻，是因为在 teammate 视图里，你已经不是在对主会话说话，而是在对某个 agent 发消息。placeholder 要先服从当前关系，才能减少误操作。

## 代价

代价是输入区要读团队上下文，连占位词都带上身份判断；但换来的是用户一眼就知道自己此刻在对谁开口。
