---
title: "面试题：processUserInput 站在哪里？它和 QueryEngine 是什么关系？"
slug: "03-01-02-processuserinput"
date: 2026-04-09
topics: [输入与路由]
importance: 1
---

# 面试题：processUserInput 站在哪里？它和 QueryEngine 是什么关系？

## 追问

面试官画了一张图：

```
用户键盘输入
     ↓
[    ???    ]
     ↓
QueryEngine.query()
     ↓
Anthropic API
```

「这个问号里，`processUserInput` 站在哪个位置？」

## 它不是什么

先把错误答案排掉。

**不是 UI 层**。UI 层只管渲染和键盘事件，不知道图片有没有缩放过、附件从哪里来、slash 命令是不是可以在这个环境下执行。

**不是主循环**。主循环（`QueryEngine.query()`）接手的是已经被整理好的 messages，它管的是「这一轮如何和模型交互、工具结果如何回填、什么时候继续推进」，不负责解析输入内容。

**不是小工具函数**。它需要同时知道消息历史、权限上下文、当前命令集合、bridge 来源、附件环境——这些信息不是一个工具函数能拿到的，必须是一个有完整上下文的独立层。

## 它真正在哪

`processUserInput` 站在 `PromptInput`（用户输入的原始来源）和 `QueryEngine.submitMessage()`（会话的真正入口）之间。

源码里的调用关系是：

```
QueryEngine.submitMessage()
  → processUserInput(input, mode, ...)
      → processUserInputBase(...)
          → 图片规范化
          → 粘贴图片落盘 + resize
          → bridge 安全检查
          → ultraplan 关键词检测
          → 附件提取
          → bash / slash / prompt 分流
      → executeUserPromptSubmitHooks(...)  ← hooks 在这里执行
  → 拿到 { messages, shouldQuery, allowedTools, model, effort }
  → 若 shouldQuery，继续 query()
```

`QueryEngine.submitMessage()` 先调它，拿到这组结果，再决定要不要真正进入本轮 query。`processUserInput` 本身不会触发 API 请求，但它的 `shouldQuery` 返回值控制着请求是否发生。

## 为什么放在这里是对的

这个位置放对了，有三个好处：

1. **主循环保持干净**。`QueryEngine.query()` 接到的是已经被系统承认的 messages，不是一团待拆包的混合物。模型推理逻辑不需要处理「这条消息是不是图片元信息」「这条命令能不能在 bridge 上执行」这类入口问题。

2. **分层边界清晰**。输入世界和会话世界的分界线在这里。过了这道线，所有东西都是被系统整理过的会话材料，而不是原始 UI 输入。

3. **可测可复用**。hooks 执行、图片处理、附件提取、命令路由——这些逻辑集中在一个函数里，比散落在主循环里更容易独立测试。

## ProcessUserInputContext 是什么

`processUserInput` 的 `context` 参数类型是 `ProcessUserInputContext`，定义为：

```typescript
export type ProcessUserInputContext = ToolUseContext & LocalJSXCommandContext
```

这个组合类型说明它需要同时知道「工具执行上下文」（权限、模型、消息历史）和「JSX 命令上下文」（setMessages、设置回调、options）。这进一步确认了它的位置：既不是纯 UI 层，也不是纯后端，是承上启下的翻译边界。

---

*面试指导：被问到「processUserInput 和 QueryEngine 什么关系」时，核心答案是「processUserInput 是 QueryEngine 入口的前置翻译层，负责把原始输入整理成主循环可接手的事件对象，QueryEngine 消费其结果但不介入输入解析」。这个定位比说「是一个帮助函数」准确得多。*
