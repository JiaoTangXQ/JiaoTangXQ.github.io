---
title: "为什么 fallback model 不该被当成普通报错分支"
slug: "04-07-01-fallback-model"
date: 2026-04-09
topics: [主循环]
summary: "很多系统一遇到模型问题，处理方式都很像异常捕获：报错，换个模型，再来一次。Claude Code 的 `fallback model` 不是这么粗糙。它更像在同一轮工作里临时换了一条路，而不是简单报错..."
importance: 1
---

# 为什么 fallback model 不该被当成普通报错分支

很多系统一遇到模型问题，处理方式都很像异常捕获：报错，换个模型，再来一次。Claude Code 的 `fallback model` 不是这么粗糙。它更像在同一轮工作里临时换了一条路，而不是简单报错重试。

这里最关键的，不是“换模型”三个字，而是它会先把上一条路收拾干净。流式 fallback 发生时，已经露出来的半截消息会被打上墓碑清掉，避免留下无效 thinking 块和孤儿工具结果；工具执行器也会被整体丢弃重建，防止旧的 `tool_use_id` 污染新的尝试；必要时还会剥掉与旧模型绑定的签名块，让新模型拿到一段干净历史。

这说明 Claude Code 把 fallback 理解成“保持同一项工作继续成立”。用户面对的不是两次互相打架的回答，而是同一轮思考被重新接到更可靠的路线上。真正优雅的地方，不是它有备用模型，而是它知道换路之前必须先清理现场。

所以 fallback model 更像绕行，不像报错。

代码上，`FallbackTriggeredError` 会让 `query()` 切到 `fallbackModel`，同时先补齐缺失的 `tool_result`、清空本轮收集到的 `assistantMessages / toolResults / toolUseBlocks`，并在特定用户类型下剥掉 model-bound 的 thinking signature，再用干净历史重试。更普通的做法是把 fallback 当成一次新的请求：直接抛错，再让外层重发用户问题。那样实现简单，但这一轮已经产生的工具轨迹和恢复语境会被切断。

Claude Code 选择“在同一轮内部切模型”，说明它更看重连续性而不是实现轻松。这样用户看到的是“同一轮继续往下走”，不是“上一轮失败，重新来过”。代价是这条分支必须处理 orphaned tool_result、thinking signature 和 executor 重建，复杂度明显高于重新发一次请求。

## 实现链
`FallbackTriggeredError` 会切模型、补 `tool_result`、重建 executor，再在同一轮里继续。

## 普通做法
把 fallback 当成一次普通失败，让外层重发请求。

## 为什么不用
因为那样会切断这一轮已形成的工具轨迹和恢复语境。

## 代价
要处理更多 model-bound 细节。
