---
title: "面试题：AppState 类型为什么用 DeepImmutable<{...}> & {...} 这种分裂写法？"
slug: "11-02-01-appstate"
date: 2026-04-09
topics: [终端界面]
summary: "AppState 的类型声明里，DeepImmutable 只包了一部分字段，tasks 和 Map 类型被故意排除在外。这个例外不是疏忽，而是因为函数类型和 DeepImmutable 不兼容，是对 TypeScript 限制的诚实承认。"
importance: 1
---

# 面试题：AppState 类型为什么用 DeepImmutable<{...}> & {...} 这种分裂写法？

```typescript
export type AppState = DeepImmutable<{
  settings: SettingsJson
  verbose: boolean
  mainLoopModel: ModelSetting
  toolPermissionContext: ToolPermissionContext
  // ... 约 40 个字段
}> & {
  // Unified task state - excluded from DeepImmutable because TaskState contains function types
  tasks: { [taskId: string]: TaskState }
  agentNameRegistry: Map<string, AgentId>
  // ...
}
```

注意这个类型定义的结构：`DeepImmutable<{...}> & {...}`。

前半部分被 `DeepImmutable` 包裹，后半部分直接用 `&` 拼接，没有不可变约束。

注释说得很清楚：`excluded from DeepImmutable because TaskState contains function types`。这不是偷懒，是 TypeScript 类型系统的实际限制。

---

## DeepImmutable 能做什么，不能做什么

`DeepImmutable` 是一个递归的只读类型，大致实现如下：

```typescript
type DeepImmutable<T> =
  T extends (infer U)[] ? ReadonlyArray<DeepImmutable<U>> :
  T extends object ? { readonly [K in keyof T]: DeepImmutable<T[K]> } :
  T
```

它把所有对象的属性变成 `readonly`，把数组变成 `ReadonlyArray`，递归处理所有嵌套结构。

这对数据对象很好用，但遇到函数就出问题了：

```typescript
type TaskState = {
  abort: () => void          // 函数
  onProgress: (msg: string) => void  // 函数
  status: 'running' | 'complete'
}
```

函数不是「数据」，它是带有上下文的行为。`DeepImmutable<() => void>` 的语义含糊，在不同的实现里行为不同，而且把函数放进深度不可变结构后，赋值兼容性和类型推断都可能出现问题。

---

## tasks 字段：为什么状态里有函数

`TaskState` 包含函数是有原因的。任务不只是数据，它是正在进行中的异步操作：

```typescript
type TaskState = {
  type: 'local_agent' | 'in_process_teammate' | ...
  status: 'running' | 'complete' | 'failed'
  messages: Message[]
  abort?: () => void        // 取消这个任务
  sendMessage?: (text: string) => Promise<void>  // 给这个任务发消息
}
```

`abort()` 是一个闭包，里面保存了如何取消这个具体任务的上下文——可能是 AbortController 的引用，可能是某个 WebSocket 的关闭函数。这个上下文是运行时的，无法被序列化成纯数据。

这类「带行为的状态」是很多状态管理框架刻意回避的，但 Claude Code 直接把它放进 AppState，因为这是最自然的表达方式：任务就是既有状态又有行为的实体。

---

## agentNameRegistry: Map 的选择

```typescript
agentNameRegistry: Map<string, AgentId>
```

这里用 `Map` 而不是 `{ [key: string]: AgentId }` 普通对象，是有意为之的。

**Map 比普通对象的优势：**
- `Map.has()` 比 `key in obj` 更语义清晰
- `Map` 不会有原型链污染（不能偶然访问到 `toString`、`__proto__` 等内置属性）
- 注释说「最新写入者胜出」，`Map.set()` 的语义比 `obj[key] = value` 更明确

**Map 的代价：**
- `Map` 是可变的，无法被 `DeepImmutable` 约束
- 无法直接序列化为 JSON（需要 `[...map.entries()]`）
- `Object.is` 比较时，即使内容相同，两个不同的 `Map` 实例也不相等

这是一个明确的权衡：用更准确的数据结构，放弃部分不可变性保证。

---

## 不可变性靠什么保证

既然 `tasks` 和 `agentNameRegistry` 不是 `DeepImmutable`，它们的不可变性靠什么保证？

靠约定和 `Store.setState` 的签名：

```typescript
setState: (updater: (prev: T) => T) => void
```

这个签名的语义是「给我一个 prev，你返回 next」。正确用法是创建新对象：

```typescript
// 正确：创建新对象
store.setState(prev => ({
  ...prev,
  tasks: { ...prev.tasks, [taskId]: newTask }
}))
```

错误用法——直接修改 prev 然后返回它——会导致 `Object.is(next, prev)` 返回 `true`（同一个引用），store 会认为状态没变，跳过通知所有监听者，UI 不会更新。这个「技术上合法但逻辑上错误」的行为会静默失败，是一种自我惩罚的约束。

---

## 类型设计小结

`AppState` 的类型展示了一个实用原则：**在能用的地方用类型约束，遇到真实限制时用注释说明，而不是强行适配或假装限制不存在。**

`DeepImmutable<{...}> & {...}` 把「能完全静态约束的字段」和「需要运行时灵活性的字段」明确区分开，在类型上诚实地反映了这两类字段的不同本质。

---

## 面试指导

类型体操话题，可以聊的点：

**`Readonly<T>` 和 `DeepImmutable<T>` 的区别？** `Readonly<T>` 只处理顶层属性，嵌套对象的属性仍然可变。`DeepImmutable` 递归处理所有层级，是真正的深度只读。

**TypeScript 里怎么判断一个类型是否包含函数？** 用条件类型：`T extends (...args: any[]) => any ? '是函数' : '不是函数'`。`DeepImmutable` 在递归时可以用类似的判断来跳过函数类型。

**Object.is vs === 的区别？** `Object.is(NaN, NaN)` 返回 `true`，而 `NaN === NaN` 返回 `false`。`Object.is(+0, -0)` 返回 `false`，而 `+0 === -0` 返回 `true`。在状态比较里，`Object.is` 的语义通常更符合「是不是真的同一个值」的直觉。
