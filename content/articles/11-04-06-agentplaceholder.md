---
title: "placeholder 文案是对当前对话对象的一次翻译"
slug: "11-04-06-agentplaceholder"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# placeholder 文案是对当前对话对象的一次翻译

打开任何普通聊天 app，输入框的占位符通常是一句永远一样的话：「输入消息」「Ask anything」「Say something…」

这种通用文案在单对话场景里够用。但 Claude Code 可以同时跑多个 teammate，用户可以随时跳进任何一个 agent 的视图。在这种多对象协作结构下，通用占位符就开始撒谎了——它假装你总是在对同一个人说话。

## viewingAgentName 触发的切换

`usePromptInputPlaceholder()` hook 的第一件事是检查 `viewingAgentName`。如果当前正在查看某个 teammate，占位词直接生成为 ``Message @${name}…``。

还有一个细节：名字过长会被截断。这避免了一个长 agent 名字把整条 placeholder 变成一串身份 token 而让文本区显得不稳定。

这两行代码在说：**先承认你现在在对谁说话，再把输入权交给你**。

## 驾驶舱里的身份感知

这不只是文案的问题。在多 agent 会话里，一个「Message @Backend-Agent…」和一个泛泛的「Ask anything」，会带来完全不同的认知负担。

前者让用户一眼知道下一句话的接收方。后者要求用户自己记住当前视图里看的是谁，然后在脑子里做上下文匹配，再开口。

认知负担的积累是慢性的。每次切换 teammate 都多一次「我现在在和谁说话」的确认步骤，听起来很小，但在长时间多 agent 工作里会让人持续分心。

placeholder 的改变把这个认知步骤从用户的脑子里移到了界面里，由界面来做，用户就不用做了。这是在对的地方做了一次合适的外包。

---

`usePromptInputPlaceholder()` 的其余部分处理历史搜索状态、vim 模式、粘贴状态等，但 viewingAgent 的分支是第一优先级——对话对象的身份，比任何其他状态都更先该被说清楚。
