---
title: "lookupsRef 是 Messages.tsx 里的隐形脊梁——什么时候写，什么时候读？"
slug: "11-08-07-lookupsref"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# lookupsRef 是 Messages.tsx 里的隐形脊梁——什么时候写，什么时候读？

大多数人把 useRef 理解为"存 DOM 引用"或"保存跨渲染的变量"，但 `lookupsRef` 展示了 ref 的第三种用途：**让稳定的回调访问最新的派生数据**。

## 写入时机：渲染函数体，不是 useEffect

```typescript
// Messages.tsx 渲染函数体里
const lookups = buildMessageLookups(normalizedMessages, messagesToShow)
lookupsRef.current = lookups  // ← 在这里，不是在 useEffect 里
```

把赋值放在函数体里（而不是 `useEffect`）的含义：

React 的渲染-提交流程是 render → commit → effects。把赋值放在 render 阶段，意味着在 commit（DOM 更新）发生之前，`lookupsRef.current` 已经是本次渲染计算的最新 lookups。

如果放进 `useEffect`，赋值发生在 commit 之后，时序上晚了一步。那么 commit 阶段挂载的新 DOM 元素绑定的事件处理器，在第一次被触发时读到的 `lookupsRef.current` 可能还是上一次渲染的旧值——这就是经典的 stale closure 问题。

## 读取时机：事件处理器和动态回调

`lookupsRef.current` 被读取的地方主要有两处：

**1. isItemClickable 回调**

```typescript
const isItemClickable = useCallback((msg: RenderableMessage) => {
  const lu = lookupsRef.current
  const toolUseId = toolUseIdOf(msg)
  const tu = lu.toolUseByToolUseID.get(toolUseId)
  // ...
}, [tools])  // lookups 不在 deps 里
```

这个回调在用户 hover 或 click 时被调用，调用时需要最新的 lookups，但函数引用本身需要稳定（不随 lookups 更新而重建）。ref 读取满足两个条件。

**2. postToolUse hook 判断**

`shouldRenderStatically` 在某些路径下读 `lookupsRef.current` 来判断 hook 是否已结清：

```typescript
const hasUnresolved = hasUnresolvedHooksFromLookup(
  toolUseId, 'PostToolUse', lookupsRef.current
)
```

这个判断决定消息是否切换到静态渲染模式，需要在每次渲染时拿到最新的 hook 状态。

## 多个 ref 的协调

`Messages.tsx` 里有不止一个这样的模式，`lookupsRef` 只是最典型的一个。还有：

- `toolsRef`：工具列表，用于在搜索和点击判断里查找工具定义，工具列表通过 props 传入但很少变化
- 在 `VirtualMessageList` 里，`jumpState` ref 持有一整个对象，包含 offsets、start、messages 等多个高频更新的值，用于两阶段跳转（seek effect 读它）

这些 ref 构成了一条隐形的数据流，在 React 的正式 props/state 体系旁边运行，专门服务于"需要最新数据但不想触发重渲"的回调。

## 什么时候该用 ref，什么时候该用 state

这是 React 面试里最经典的判断题：

**用 state**：数据变化需要触发 UI 重渲（比如消息列表、展开状态、搜索 query）

**用 ref**：数据变化不需要 UI 重渲，只需要在下一次事件或 effect 触发时被读到（比如 lookups、offsets、搜索锚点位置）

`lookups` 本身是从 state 派生的（依赖 messages 和 messagesToShow），不需要单独用 state 存，只需要在渲染函数体里计算，然后同步写进 ref。

## 面试指导

这道题真正在检验的是你对 React 渲染-提交-effect 生命周期的理解，以及如何在"总是渲染最新"和"不过度渲染"之间找平衡。

**核心论证路径**：

1. `lookupsRef.current` 需要在事件处理器里读到"本次渲染"的 lookups
2. 如果写入在 `useEffect` 里，事件处理器触发时 effect 还没跑，读到的是旧值
3. 如果写入在渲染函数体里，渲染先于 commit，commit 先于事件绑定，所以事件处理时读到的是本次渲染的值

**常见错误**：把 `lookupsRef.current = lookups` 的赋值当作"副作用"（side effect）而移到 `useEffect` 里。React 文档确实说"渲染函数应该是纯函数"，但这里的 ref 赋值是有意识的"读-写"协议，不同于真正的副作用（网络请求、订阅等）。这种在渲染阶段写 ref 的模式在 React 官方代码和高质量开源库里非常常见。

**加分追问**：Strict Mode 下 React 会双调用渲染函数，lookupsRef 会被写两次，有没有问题？答：没有问题，因为两次调用产生相同的 lookups（纯函数），两次写入的是同一个值，最终状态正确。
