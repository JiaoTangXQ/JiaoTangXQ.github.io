---
title: "Prompt Engineering 已死，长期主义万岁"
slug: prompt-engineering-is-dead
date: 2026-03-05
topics: [AI, 技术]
summary: "当模型越来越强，精心设计的 prompt 技巧正在贬值。真正有价值的是理解 AI 的能力边界并设计好的人机协作流程。"
cover:
  style: gradient
  accent: "#6d61ff"
importance: 1.2
---

## Prompt 技巧的半衰期

2023 年，"在 prompt 末尾加上 Let's think step by step" 能显著提升回答质量。2024 年，模型内置了 chain-of-thought。2025 年，你甚至不需要告诉模型"仔细思考" —— 它默认就会。

这就是 prompt engineering 的核心矛盾：**越有效的技巧，越快被模型内化**。

## 真正持久的是什么

不是 prompt 模板，不是 few-shot 示例库，不是什么 "mega prompt" 框架。

持久的是：

1. **对任务的清晰定义** —— 你知道你要什么，能精确表达
2. **对模型能力边界的理解** —— 你知道什么该交给 AI，什么该自己做
3. **人机协作的流程设计** —— 你知道在什么节点审查、在什么节点放手

这三样东西不会因为模型升级而过时。它们是**元技能**，不是技巧。

## 从 prompt 到 protocol

与其花时间打磨一个 prompt，不如设计一个 protocol：

- AI 先做初稿，人审查方向
- 人给反馈，AI 迭代细节
- 最终人做品味判断

这个流程不依赖任何特定的 prompt 写法。它依赖的是你对"好"的定义和对 AI 能力的准确评估。
