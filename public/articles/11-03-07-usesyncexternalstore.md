---
title: "面试题：useSyncExternalStore 和 useEffect+useState 订阅外部 store，哪个更好？"
slug: "11-03-07-usesyncexternalstore"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# 面试题：useSyncExternalStore 和 useEffect+useState 订阅外部 store，哪个更好？

React 18 引入了 `useSyncExternalStore`，这个 API 不是为了方便，而是为了修复一个在并发模式下才会出现的 bug。

Claude Code 的 `useAppState` 用的正是这个 API：

```typescript
export function useAppState(selector) {
  const store = useAppStore()
  const get = () => selector(store.getState())
  return useSyncExternalStore(store.subscribe, get, get)
}
```

为什么不用更熟悉的 `useEffect+useState` 方案？

---

## 传统方案的写法

在 `useSyncExternalStore` 出现之前，订阅外部 store 的标准写法是：

```typescript
function useExternalStore(store, selector) {
  const [state, setState] = useState(() => selector(store.getState()))

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setState(selector(store.getState()))
    })
    return unsubscribe
  }, [store, selector])

  return state
}
```

逻辑清晰：用 `useState` 存 selector 的当前结果，用 `useEffect` 订阅变化，变化时更新 state。

这段代码在 React 17 里正常工作，在 React 18 的并发模式下有一个问题。

---

## 并发模式下的「撕裂」

React 18 的并发模式允许渲染被打断。浏览器有更高优先级的任务时（比如用户输入），React 可以暂停正在进行的渲染，先处理高优先级的任务，再继续之前的渲染。

这个「可以被打断」的特性，打破了「一次渲染期间状态不会变化」的假设。

考虑这个场景：

```
t=0ms   React 开始渲染整棵组件树
t=0ms   组件 A 读取 store，值是版本 1
t=1ms   React 暂停渲染（处理高优先级的用户输入）
t=1ms   用户输入触发 store 更新，store 变为版本 2
t=2ms   React 继续渲染
t=2ms   组件 B 读取 store，值是版本 2
```

结果：同一次渲染里，组件 A 看到版本 1，组件 B 看到版本 2。这棵树里有两个不同的「真相」——这就是「撕裂」（tearing）。

`useEffect+setState` 方案无法解决这个问题：`useEffect` 在渲染完成后才运行，`setState` 的调用是异步的，无法在渲染中途强制同步。

---

## useSyncExternalStore 如何解决撕裂

`useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` 的机制不同：

React 在提交渲染结果到 DOM **之前**，会做一次最终检查：对每个调用了 `useSyncExternalStore` 的组件，重新调用 `getSnapshot()`，用 `Object.is` 和渲染时记录的快照比较。如果不同（说明在渲染过程中 store 被更新了），React 会**同步地**重新触发渲染，确保整棵树基于同一版本的 store 数据。

「Sync」的含义就在这里：不允许在渲染结果提交时存在撕裂，强制与 store 同步。

在 Claude Code 的实现里：

```typescript
const get = () => selector(store.getState())
return useSyncExternalStore(store.subscribe, get, get)
```

每次组件渲染时，React 调用 `get()` 记录当前快照。如果在渲染完成前 `store.subscribe` 的监听器被触发（说明 store 被更新了），React 会重新渲染，确保所有组件基于相同的 store 版本。

---

## Claude Code 里为什么撕裂的概率不低

在 Claude Code 的实际使用场景里：

- 用户打字时每次按键都触发状态更新（输入内容变化）
- 流式 AI 输出时每个 token 都是一次状态更新
- 后台任务进展时频繁更新任务状态

在这种高频更新的环境里，「渲染过程中 store 被更新」的概率远高于普通 CRUD 应用。

如果发生撕裂，可能出现的问题：

```
权限状态组件读到「bypass 模式开启」
同一次渲染里，工具调用组件读到「bypass 模式关闭」
→ 按钮显示允许，但点击后被拒绝
```

这类 bug 是概率性的、难以复现的，因为它依赖特定的时序。`useSyncExternalStore` 从机制上消灭了这类问题。

---

## selector 的 Object.is 比较

`useSyncExternalStore` 在每次 store 通知变化时，调用 `getSnapshot()` 获取新快照，然后用 `Object.is` 和上次的快照比较，只有不同时才触发重渲染。

这就是 selector 的价值：

```typescript
// 组件只在 verbose 字段变化时重渲染
const verbose = useAppState(s => s.verbose)

// 组件只在 mainLoopModel 字段变化时重渲染
const model = useAppState(s => s.mainLoopModel)
```

即使 store 每秒更新几十次，如果这两个字段没有变化，这两个组件就不会重渲染。selector 把「store 的任何变化」过滤成「我关心的那一小片变化」。

这个过滤效果依赖 `Object.is` 的 O(1) 比较：基本值直接比较值，对象引用比较内存地址。这也是为什么 selector 不能返回新对象——每次都创建新对象，`Object.is` 永远是 `false`，过滤效果就失效了。

---

## 服务端快照参数

```typescript
return useSyncExternalStore(store.subscribe, get, get)
//                                                 ^^^
//                              第三个参数：服务端快照
```

第三个参数是在服务端渲染（SSR）时用的。当在 Node.js 里渲染时，store 可能不可用或需要不同的初始化方式，第三个参数提供了一个「服务端版本的 getSnapshot」。

Claude Code 是终端应用，不需要 SSR，两个参数用了同一个函数 `get`。这在实践中没有副作用，也表达了「客户端和服务端行为一致」的意思（虽然在终端应用的语境里这个说法没有实际意义）。

---

## 面试指导

**什么是并发模式，为什么它让撕裂成为问题？**

并发模式（Concurrent Mode）允许 React 在渲染高优先级更新时暂停低优先级的渲染。在非并发模式里，一次 `render()` 调用到 DOM 提交是同步的，不会被打断，外部 store 在这期间不可能变化。并发模式打破了这个假设：渲染可以在任何时间点暂停，store 在暂停期间可以被更新。

**`useSyncExternalStore` 的 subscribe 参数有什么约束？**

`subscribe` 必须是稳定的引用（不能每次渲染都是新函数），因为 React 依赖它的引用稳定性来判断是否需要重新订阅。Claude Code 的 `store.subscribe` 是单例 store 的方法，引用永远稳定，满足这个约束。

**Zustand v4 之前的实现有撕裂问题吗？**

有。Zustand v3 用的是 `useReducer` + `useEffect` 订阅，在并发模式下有撕裂风险。Zustand v4 迁移到了 `useSyncExternalStore`，解决了这个问题。这是 Claude Code 选择直接用 `useSyncExternalStore` 而不是依赖第三方状态库的原因之一——可以确保用的是正确的 React 18 API，而不依赖第三方库是否已经完成迁移。

**getSnapshot 函数需要是纯函数吗？**

是的，`getSnapshot` 必须是纯函数（同样的输入总是返回同样的输出，没有副作用）。React 可能在渲染外调用它（比如在检测是否发生撕裂时），如果它有副作用，可能导致意外行为。`() => selector(store.getState())` 是纯函数：给定当前 store 状态，总是返回同样的结果。
