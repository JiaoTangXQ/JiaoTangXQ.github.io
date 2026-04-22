---
title: "filterForBriefTool 删冗余，不删解释"
slug: "11-07-06-briefsystemerror"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# filterForBriefTool 删冗余，不删解释

`filterForBriefTool()` 是 brief 模式的核心过滤器。它的任务是：在保持会话可读性的前提下，最大程度地压缩助手产生的冗余文本。

关键词是**冗余**。

## 什么被删，什么被留

| 消息类型 | 处理 |
|---------|------|
| assistant 正文（非 Brief 工具） | 删除 |
| Brief 工具的 tool_use | 保留 |
| 对应的 tool_result | 保留 |
| 真实用户输入 | 保留 |
| system 消息 | 保留（但排除 api_metrics） |
| API error | 保留 |
| isMeta 的伪用户消息 | 删除 |

删除的是「已经被 Brief 工具替代的助手铺陈」。保留的是「理解这轮会话需要的骨架信息」。

## 为什么 system 消息和 error 不能删

Brief 模式的目标是减少阅读量，让用户能更快地理解发生了什么。但 system 消息和 API error 恰恰是「理解发生了什么」所必需的信息。

如果一次 API 调用失败了，删掉 error 消息，用户就只看到「这轮什么都没发生」，而不知道是失败了。如果 system 消息也删掉，用户就看不到当前的工具权限设置或环境配置。

压缩的目的是去掉已经有 Brief 工具覆盖的重复内容，而不是让用户理解会话更难。把解释信息也删掉，brief 就变成了一个让人摸不着头脑的黑盒。

## dropTextInBriefTurns 的补充

`filterForBriefTool()` 的兄弟函数 `dropTextInBriefTurns()` 做的是另一个方向的优化：在完整 transcript 里，找到那些调用了 Brief 工具的轮次，把那轮里多余的助手正文文本删掉（因为 Brief 工具的输出已经更简洁地表达了同样的内容）。

两个函数合在一起，解决的是同一个问题的两个面：brief 过滤应该聪明到「知道哪些文字是冗余的」，而不是简单到「除了工具调用什么都删」。
