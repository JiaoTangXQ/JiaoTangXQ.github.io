---
title: "面试陷阱：useAppState(s => ({ text: s.text })) 有什么问题？"
slug: "11-03-02-selector"
date: 2026-04-09
topics: [终端界面]
summary: "useAppState(s => ({ text: s.promptSuggestion.text, id: s.promptSuggestion.promptId })) 每次都返回新对象，每次 AppState 任何字段变化都触发重渲染。这不是 bug，是 Object.is 比较语义的必然结果，也是 selector 最常见的误用方式。"
importance: 1
---

# 面试陷阱：useAppState(s => ({ text: s.text })) 有什么问题？

源码注释里有一段特别直接的警告：

```typescript
/**
 * Do NOT return new objects from the selector -- Object.is will always see
 * them as changed. Instead, select an existing sub-object reference:
 * ```
 * const { text, promptId } = useAppState(s => s.promptSuggestion) // good
 * ```
 */
export function useAppState(selector) {
```

这个约束是 `useSyncExternalStore` 机制的直接推论，不是任意的 API 设计限制。

---

## 为什么新对象会造成无限重渲染

`useSyncExternalStore` 的工作流程：

1. 存储 selector 的当前返回值（作为 snapshot）
2. 每次 store 通知变化时，重新调用 selector
3. 用 `Object.is(newSnapshot, prevSnapshot)` 比较
4. 如果不同，触发组件重渲染

关键在第 3 步：`Object.is` 比较的是**引用**，不是内容。

```typescript
Object.is({ a: 1 }, { a: 1 })  // false，两个不同的对象
Object.is('hello', 'hello')     // true，字符串是值类型
Object.is(42, 42)               // true，数字是值类型
```

所以：

```typescript
// 坏的 selector：每次都返回新对象
const data = useAppState(s => ({
  text: s.promptSuggestion.text,
  id: s.promptSuggestion.promptId,
}))
// 每次 store 变化（不管哪个字段），selector 返回新对象
// Object.is(newObj, prevObj) === false
// 组件重渲染
// 重渲染时又调用 selector，又返回新对象
// ...（无限循环？不，但每次 store 变化都会重渲染）
```

「无限重渲染」的说法不完全准确——组件不会在 store 没变化时自己触发重渲染。但每次 `store` 里任何字段变化（比如任务状态更新），这个组件就会重渲染，即使 `promptSuggestion` 完全没变。这违背了 selector 的优化目的。

---

## 正确的写法

**方法一：返回已存在的对象引用**

```typescript
// 好的写法：返回已存在的引用
const promptSuggestion = useAppState(s => s.promptSuggestion)
const { text, promptId } = promptSuggestion  // 在组件内部解构
```

`s.promptSuggestion` 是 AppState 里已有的对象。只有当 `promptSuggestion` 这个对象引用本身变化时（即有人调用了 `setState(prev => ({ ...prev, promptSuggestion: newObj }))` 创建了新的 `promptSuggestion` 对象），selector 的返回值才会不同，组件才会重渲染。

**方法二：分别 selector 独立字段**

```typescript
// 多次调用 selector，每次选一个原始值
const text = useAppState(s => s.promptSuggestion.text)
const promptId = useAppState(s => s.promptSuggestion.promptId)
```

原始值（字符串、数字、布尔）的比较直接用值，不会有这个问题。

**方法三：用 useMemo 记忆化派生对象**

如果确实需要在 selector 里计算派生对象：

```typescript
const rawData = useAppState(s => s.promptSuggestion)
const derivedData = useMemo(
  () => ({ text: rawData.text, id: rawData.promptId }),
  [rawData.text, rawData.promptId]
)
```

先 selector 选出原始数据（用引用比较），再在组件内用 `useMemo` 派生想要的格式。

---

## 源码里的防御性检查

Claude Code 曾经有一个在开发模式下检测这个问题的逻辑：

```typescript
const get = () => {
  const state = store.getState()
  const selected = selector(state)
  if (false && state === selected) {  // 注意 false &&，这个检查已被禁用
    throw new Error(
      `Your selector returned the original state, which is not allowed.`
    )
  }
  return selected
}
```

注意 `false &&` 前缀——这个检查现在是死代码，被禁用了。可能在开发阶段验证完 selector 的正确性后就关掉了。

这段代码想检测的是「selector 直接返回整个 state」（而不是返回新对象），但它用的检测条件是 `state === selected`（引用相同），无法检测「创建了新对象」这种情况。

对于「返回新对象」的问题，最终还是靠约定和文档来防止，没有运行时检测。

---

## 什么时候安全地「返回对象」

有一种情况是安全的：返回 `AppState` 里本身存在的**嵌套对象引用**。

```typescript
// 安全：返回已存在的嵌套对象
const toolPermissionContext = useAppState(s => s.toolPermissionContext)
```

只要 `toolPermissionContext` 这个字段的引用没有变化（即没有人用 `setState` 创建了新的 `toolPermissionContext` 对象），`Object.is` 比较就会返回 `true`，组件不会重渲染。

Claude Code 遵循不可变更新模式——每次更新都创建新对象——所以这个策略是有效的：如果某次 `setState` 没有改变 `toolPermissionContext`，那么 `newState.toolPermissionContext === oldState.toolPermissionContext`（同一个引用），selector 的返回值不变，组件不会重渲染。

---

## 面试指导

**`Object.is` vs `===` vs `JSON.stringify` 三种比较方式各适合什么场景？**

- `Object.is`：最轻量，只比较引用/值，O(1)，适合频繁调用的 selector 比较
- `===`：行为和 `Object.is` 几乎相同（主要区别是 NaN 和 +0/-0），可以互换
- `JSON.stringify`：比较内容而不是引用，但 O(n)（n 是对象大小），而且不能处理循环引用和 Map/Set

**为什么不用 deep equality（深度比较）？**

深度比较（如 `lodash.isEqual`）能解决「新对象但内容相同」的问题，但成本是 O(n)。在每次 store 变化时对每个 selector 都做深度比较，可能比重渲染组件还贵。`Object.is` 的 O(1) 特性是这套机制能高效运行的基础。

**Zustand 的 shallow 比较是什么？** Zustand 提供了 `shallow` 比较函数，对对象的顶层属性做 `Object.is` 比较（而不是对对象整体）。这可以安全地从 selector 返回包含多个原始值的对象，只要对象的顶层属性没变就不会重渲染。Claude Code 的方案更严格，要求 selector 不返回新对象，但也更高效。
