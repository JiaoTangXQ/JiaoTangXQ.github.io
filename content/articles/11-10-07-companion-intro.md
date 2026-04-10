---
title: "companion_intro 只进一次上下文：避免在每轮里反复自我介绍"
slug: "11-10-07-companion-intro"
date: 2026-04-09
topics: [终端界面]
summary: "getCompanionIntroAttachment(messages) 在生成 companion_intro 附件前，会扫描 messages 里是否已经有同名的介绍。有了就跳过，没有才注入。模型认识伙伴只需要一次，不用每轮重复。"
importance: 1
---

# companion_intro 只进一次上下文：避免在每轮里反复自我介绍

`buddy/prompt.ts` 的 `getCompanionIntroAttachment()` 在注入 companion 介绍之前，会先检查：

```typescript
// 简化逻辑
const alreadyIntroduced = messages.some(
  msg => isCompanionIntroAttachment(msg) && 
         msg.companionName === currentCompanion.name
);
if (alreadyIntroduced) return null;
```

如果当前会话里已经有这个 companion 的介绍，就不再重复注入。

## 为什么不每轮都发一次

每次调用模型都发一遍 companion 介绍，表面上保证了「模型一定知道伙伴是谁」。但实际的代价是：

**上下文污染**：每轮都有一段 companion 介绍文字，这些文字会占用上下文窗口，减少模型可以用来处理真正有用信息的空间。

**语义重复**：模型在一次会话里看到同样的介绍文字十次，这十次都是噪音——模型已经从第一次学会了，后续的重复对它没有额外帮助。

**不像真实关系**：在真实世界里，你不需要每次和朋友说话前都先介绍一遍「这是我的朋友 xxx，性格如何如何」。介绍只需要一次，之后大家就有了共同背景。

## 「只引入一次」是记忆管理

这个设计是在做一种简单的记忆管理：把 companion 的背景信息（身份、边界、行为期望）当成会话级别的长期记忆，而不是每次请求都重发的短期提示。

第一次介绍，模型有了这份背景。之后，它一直在上下文窗口里（除非超出窗口长度），不需要重复发送。代码里的检查确保了这个「只引入一次」的语义真正被执行，不会因为某次调用路径的遗漏而意外重复。
