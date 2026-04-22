---
title: "注册 backend 和探测环境是两件不同的事，为什么 Claude Code 把它们分开？"
slug: "09-08-06-backend"
date: 2026-04-09
topics: [多Agent协作]
importance: 1
---

# 注册 backend 和探测环境是两件不同的事，为什么 Claude Code 把它们分开？

`registry.ts` 里有两个功能上相关但刻意分开的函数：

```typescript
let backendsRegistered = false

function ensureBackendsRegistered(): void {
  if (backendsRegistered) return
  backendsRegistered = true
  
  // 动态 import，触发各 backend 模块的自注册副作用
  import('./TmuxBackend')
  import('./ITermBackend')
  // InProcessBackend 是内建的，不需要动态 import
}

export async function detectAndGetBackend(): Promise<BackendDetectionResult> {
  if (cachedDetectionResult !== null) return cachedDetectionResult
  
  ensureBackendsRegistered()  // 先确保已注册
  
  // 然后才执行真正的探测：shell 命令、环境变量检测……
  const result = await runBackendDetection()
  cachedDetectionResult = result
  return result
}
```

一个函数只做 `import`，另一个函数才执行真正的检测。为什么不合并成一个步骤？

## 两件事的成本完全不同

`ensureBackendsRegistered()` 的成本是：执行两个动态 `import()` 语句，触发模块加载和自注册副作用。这个操作是：
- 纯 JavaScript 模块系统操作
- 不访问文件系统（除了 Node.js 模块缓存）
- 不执行任何 shell 命令
- 不访问任何外部进程

耗时：微秒级（模块已在磁盘缓存中时）到几毫秒。

`detectAndGetBackend()` 的成本是：执行多个 shell 命令来探测环境：
- `tmux display-message -p '#{session_name}'`（检查是否在 tmux 里）
- `which tmux`（检查 tmux 是否安装）
- 读取 `$TERM_PROGRAM`（检查是否在 iTerm2 里）
- 可能还有 iTerm2 Python API 探测

耗时：几十毫秒，有时超过 100ms。

成本差距是 3-4 个数量级。分开这两件事，是在说：**准备工作（注册）是廉价的，可以在需要时随时做；探测工作是昂贵的，应该尽可能延迟，且只做一次**。

## 自注册模式：backend 模块知道怎么注册自己

`TmuxBackend.ts` 和 `ITermBackend.ts` 使用自注册模式：

```typescript
// TmuxBackend.ts 末尾
registerBackend({
  name: 'tmux',
  detect: async () => { /* tmux 探测逻辑 */ },
  create: (config) => new TmuxBackend(config),
})
```

```typescript
// ITermBackend.ts 末尾
registerBackend({
  name: 'iterm2',
  detect: async () => { /* iTerm2 探测逻辑 */ },
  create: (config) => new ITermBackend(config),
})
```

这段代码在模块被导入时作为**副作用**自动执行。`ensureBackendsRegistered()` 通过触发 `import('./TmuxBackend')` 来触发这个副作用。

好处：每个 backend 的注册逻辑封装在 backend 自己的文件里，`registry.ts` 不需要知道每个 backend 的具体注册参数。新增一个 backend 只需要：
1. 在新模块末尾写自注册代码
2. 在 `ensureBackendsRegistered()` 里加一行 `import('./NewBackend')`

`registry.ts` 的其余逻辑不需要改动。

## 懒加载的边界在哪里

在多 agent 功能的整个初始化路径里，有几个明确的懒加载边界：

**第一个边界：`ensureBackendsRegistered()`**
触发条件：第一次调用 `detectAndGetBackend()` 或 `getTeammateExecutor()`
操作：模块导入，触发自注册
成本：低

**第二个边界：`detectAndGetBackend()`**
触发条件：第一次需要知道用哪个后端
操作：shell 命令探测环境
成本：高，但只执行一次（结果缓存在 `cachedDetectionResult`）

**第三个边界：`getTeammateExecutor()`**
触发条件：第一次实际创建 teammate
操作：根据探测结果选择执行器，创建并缓存
成本：中等

这三个边界从低成本到高成本递进，每一层都只在真正需要时才执行，且执行结果都被缓存，不重复执行。

## 为什么要把模块注册和环境探测分开

如果把两件事合并，`ensureBackendsRegistered()` 也执行 shell 命令：

```typescript
// 假设的合并版本（不好）
async function ensureBackendsAndDetect(): Promise<void> {
  if (backendsRegistered) return
  backendsRegistered = true
  
  import('./TmuxBackend')
  import('./ITermBackend')
  await runBackendDetection()  // 每次第一次调用都要等这个
}
```

问题出现了：`ensureBackendsRegistered()` 原本是同步函数（不需要 `await`），现在变成了异步。任何调用它的地方都需要 `await`，整个调用链向上传播异步性。

更根本的问题：**注册（声明 backend 存在）和探测（检测哪个可用）是不同的事情**。注册描述"什么是可能的"，探测确定"什么是实际可用的"。把两件事合并，隐含了"只要声明存在就立刻探测"的假设，但这个假设并不总是成立——比如测试里可能想注册 backend 但 mock 探测结果。

分开两件事，保持了每件事的语义纯粹性：注册是纯声明，探测是纯查询。

## 面试怎么答

如果面试题是"如何设计一个支持多种执行后端的插件系统，同时保持低启动延迟"：

**关键洞察**：插件系统通常有两个阶段——注册阶段（声明插件存在）和激活阶段（实际初始化/探测插件）。这两个阶段的成本通常差距很大，应该分别懒加载。

**设计方案**：
1. **自注册模式**：每个插件在自己的模块里注册，主模块只需要 `import` 触发副作用。新增插件不需要修改主模块逻辑。
2. **懒加载边界**：注册（`import`）和激活（`detect()`）分开，注册在第一次需要选择后端时发生，激活在第一次实际使用后端时发生。
3. **结果缓存**：激活操作（尤其是涉及 I/O 的探测）的结果缓存起来，进程生命周期内不重复执行。

**成本分析**：如果用户会话里从未用到多 agent 功能，`TmuxBackend.ts` 和 `ITermBackend.ts` 的模块代码也许根本不会被加载（取决于代码分割策略）。如果会话用到了多 agent，注册成本极低（微秒级），探测成本被缓存吸收（只执行一次）。整体上，大多数用户的代价趋近于零，重度用户的代价被控制在最小。
