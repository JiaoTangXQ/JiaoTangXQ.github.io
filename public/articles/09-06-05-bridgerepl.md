---
title: "只注册不注销的全局桥会产生什么问题？从 stale closure 到幽灵调用"
slug: "09-06-05-bridgerepl"
date: 2026-04-09
topics: [多Agent协作]
importance: 1
---

# 只注册不注销的全局桥会产生什么问题？从 stale closure 到幽灵调用

`leaderPermissionBridge.ts` 里的每个 register 函数，都有一个对应的 unregister：

```typescript
export function registerLeaderToolUseConfirmQueue(setter: SetToolUseConfirmQueueFn): void {
  registeredSetter = setter
}
export function unregisterLeaderToolUseConfirmQueue(): void {
  registeredSetter = null
}
```

这种对称设计很常见，通常被当作"良好工程习惯"一带而过。但如果不做 unregister，会发生什么具体问题？

## 场景一：REPL 组件重新挂载

React 有时会卸载并重新挂载组件——这在严格模式（StrictMode）下是常见的（React 18 会故意挂载/卸载/重新挂载组件来检测副作用）。

**只注册不注销的情况：**

```
t=0: REPL 第一次挂载
     registerLeaderToolUseConfirmQueue(setterV1)
     → registeredSetter = setterV1

t=1: REPL 卸载（StrictMode 的故意卸载）
     未调用 unregister
     → registeredSetter 仍是 setterV1

t=2: REPL 重新挂载（新实例）
     registerLeaderToolUseConfirmQueue(setterV2)
     → registeredSetter = setterV2  ← 旧的 setterV1 被覆盖

t=3: Worker 调用 getLeaderToolUseConfirmQueue()() 
     → 调用的是 setterV2，正确
```

这个场景看起来没问题——但只是运气好：新挂载的组件及时覆盖了旧的 setter。

**更危险的场景：** 如果 t=2 和 t=3 的顺序换一下：

```
t=1: REPL 卸载（未注销）
t=2: Worker 在卸载和重挂之间请求权限
     → 调用的是 setterV1（已卸载组件的 setter）
     → 幽灵调用
```

## 场景二：stale closure 的幽灵调用

`setterV1` 是一个 closure，它在 REPL 第一次挂载时捕获了组件的内部状态——包括 `toolUseConfirmQueue` 的引用、组件实例的上下文。

当 REPL 卸载后，这些被 closure 捕获的引用是什么状态？

在 React 18 里，对已卸载组件调用 setState 会被**静默忽略**（React 18 之前会产生 warning）。所以直接的错误不会发生。但：

1. **调用没有效果**：Worker 以为权限请求已经推进队列，实际上被静默丢弃了。Worker 会一直等待用户响应，但 Leader UI 上永远不会出现弹窗。这是一个**静默的协议破坏**，很难调试。

2. **内存泄漏风险**：模块级变量 `registeredSetter` 持有对 `setterV1` 的引用，`setterV1` 持有对旧组件实例的引用（通过 closure 捕获）。只要 `registeredSetter` 没有被设为 null，旧的组件实例就无法被 GC 回收。

## 场景三：热重载的竞争条件

在开发模式下，文件修改触发热重载时，React 组件会被重新挂载。如果旧组件的 cleanup 没有运行（某些热重载实现不会触发 cleanup），新旧 setter 可能同时存在于某个中间状态。

`unregisterLeaderToolUseConfirmQueue` 通过 `useEffect` cleanup 在组件卸载时自动运行：

```typescript
useEffect(() => {
  registerLeaderToolUseConfirmQueue(setConfirmQueue)
  registerLeaderSetToolPermissionContext(setPermissionContext)
  
  return () => {
    // cleanup：组件卸载时自动调用
    unregisterLeaderToolUseConfirmQueue()
    unregisterLeaderSetToolPermissionContext()
  }
}, [setConfirmQueue, setPermissionContext])
```

这保证了：只要组件卸载，桥就被清除，不会留下 stale setter。

## "外溢接口必须有退出协议"

这是比 unregister 本身更重要的工程原则。

"外溢接口"指的是跨越模块边界、绕过正常抽象层的接口——`leaderPermissionBridge` 就是这种，它是执行层绕过 React 组件树直接操控 UI 状态的后门。

所有外溢接口都有一个共同特征：它们创建了正常生命周期管理之外的引用关系。正常的 React 父子组件关系，生命周期是受 React 管理的；但模块级变量持有的 setter 引用，React 不知道也不管理。

**因此，外溢接口的创建者必须自己管理这个引用的生命周期**，通过显式的 register/unregister 协议。不能期望 React 或 GC 来帮你做这件事，因为它们不知道这个引用的存在。

这个原则适用于所有类似的模式：

- Event listener 的 `addEventListener` 必须配对 `removeEventListener`
- `setInterval` 必须配对 `clearInterval`
- 外部库的 `subscribe` 必须配对 `unsubscribe`

这些都是"外溢引用"，都需要显式的退出协议。

## 面试怎么答

如果面试题是"使用全局变量存储 React setter 时，有什么风险"：

**核心风险**：stale closure——setter 指向已卸载组件的状态，调用时静默无效或造成内存泄漏。

**如何缓解**：对称的注册/注销 + `useEffect` cleanup，把桥的生命周期和组件生命周期绑定。

**深层原则**：任何创建了"生命周期管理范围之外的引用"的接口，都需要显式的退出协议。这不是"最佳实践"，而是防止内存泄漏和幽灵调用的必要措施。

**识别方法**：如果你在组件里创建了一个"跑出去"的引用（注册到全局、传给外部库、存到模块变量），都要问：当这个组件被销毁时，这个引用会自动失效吗？如果不会，你需要在 `useEffect` cleanup 里手动清理它。
