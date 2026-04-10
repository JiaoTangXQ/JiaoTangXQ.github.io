---
title: "非 React 代码怎么更新 React 状态？leaderPermissionBridge 的跨层通信模式"
slug: "09-06-03-leaderpermissionbridge"
date: 2026-04-09
topics: [多Agent协作]
summary: "inProcessRunner.ts 是 TypeScript 的普通异步代码，不是 React 组件，没有 useRef、useContext 可用。但它需要更新 Leader 界面的权限队列（一个 React 状态）。这个跨层通信问题，Claude Code 用一个 55 行的桥文件解决了。这篇分析这个方案的原理和取舍。"
importance: 1
---

# 非 React 代码怎么更新 React 状态？leaderPermissionBridge 的跨层通信模式

这是一个真实的工程问题，不是理论问题。

`inProcessRunner.ts` 需要做一件事：当 Worker 请求权限时，把这个请求推进 Leader 界面的确认队列（`toolUseConfirmQueue`），触发 React 重渲染，让用户看到弹窗。

问题：`inProcessRunner.ts` 是普通的 TypeScript 异步代码，运行在 React 组件树之外。它没有 `useContext` 可调用，没有 ref 可访问，无法直接调用 `setToolUseConfirmQueue`（这是一个 React `useState` 的 setter）。

怎么打通这两层？

## 常见的几种方案

**方案 A：把执行循环移进 React**

把 `inProcessRunner.ts` 的逻辑包进一个 React 组件（或 custom hook），这样它就能直接访问 React 状态。

问题：执行循环是长时间运行的异步操作，在 React 组件里管理复杂异步生命周期非常繁琐。React 是为 UI 渲染设计的，不是为长时间异步任务管理设计的。强行放进去会让两层的关注点严重混杂。

**方案 B：全局状态管理库（Redux/Zustand）**

两层都通过同一个 store 通信。执行循环调用 `store.dispatch(addPermissionRequest(...))`，React 组件 `useSelector` 监听相关状态变化。

问题：为了打通这一个接口，引入了完整的状态管理库。依赖变重，初始化成本高，而且本质上是一样的"全局变量"，只是更正式了一点。

**方案 C：EventEmitter / pub-sub**

执行循环发送事件，React 组件订阅。这是松耦合的，但事件的类型系统很弱（TypeScript 对事件回调的类型推断有限），容易产生"发了事件但没有人订阅"的静默失败。

**方案 D：leaderPermissionBridge（模块级 setter 注册）**

React 组件把自己的 setter 注册到一个模块级变量，非 React 代码通过这个变量调用 setter。

这就是 Claude Code 的选择。

## 为什么选方案 D

核心优势：**最小侵入，明确类型**。

React 组件只需要在 `useEffect` 里加两行：

```typescript
useEffect(() => {
  registerLeaderToolUseConfirmQueue(setToolUseConfirmQueue)
  return () => unregisterLeaderToolUseConfirmQueue()
}, [setToolUseConfirmQueue])
```

执行循环只需要：

```typescript
const setQueue = getLeaderToolUseConfirmQueue()
if (setQueue) {
  setQueue(prev => [...prev, newRequest])
}
```

类型完全正确（TypeScript 可以推断出 `setQueue` 的类型），没有引入新依赖，没有大规模重构，整个桥文件 55 行。

这是一种**有意识的全局状态**：知道自己在用全局变量，知道它的生命周期（组件挂载时注册，卸载时清除），知道它可能为 null（所以有 null 检查）。和"随意的全局变量"不同，这里有完整的设计意图。

## 桥的边界在哪里

`leaderPermissionBridge.ts` 只暴露两个 setter：

```typescript
// 往权限确认队列推请求
export function registerLeaderToolUseConfirmQueue(setter: SetToolUseConfirmQueueFn): void

// 更新权限上下文（比如新的 always-allow 规则）
export function registerLeaderSetToolPermissionContext(setter: SetToolPermissionContextFn): void
```

两个。不是十个，不是整个 AppState 的 setter。

这个边界是刻意设置的。如果把 `setMessages`、`setToolPermissionContext`、`setCurrentModel`…… 全都注册进来，执行循环就能直接操控 UI 的任何状态，两层之间的边界消失了。

**窄接口原则**：跨层的接口应该只暴露两层之间确实需要传递的内容，不应该为了方便而开放更多。每一个额外开放的 setter 都是一个潜在的依赖点，未来修改 UI 时可能意外影响执行层的行为。

## 组件卸载时不注销会怎样

如果 REPL 组件卸载了（比如用户切换视图，React 重新挂载了组件），旧的 `setToolUseConfirmQueue` 是一个 stale closure——它指向旧组件实例的状态。

调用 stale closure 会：
- React 18 里：静默无效（React 18 已处理了对已卸载组件的 setState 调用）
- 旧版 React：产生 "Can't perform a React state update on an unmounted component" 警告
- 最坏的情况：新组件实例挂载后，两个 setter（旧的和新的）都被注册，导致双重更新

不注销的后果是"不确定的行为"，这在并发场景下是非常危险的——你不知道哪次调用会触发，哪次会被忽略。

对称的 `unregister` + `useEffect` cleanup，把桥的生命周期和组件的生命周期绑定，消除了这种不确定性。

## 这个模式在哪里还出现

这种"注册/注销 setter 到模块级变量"的模式，在以下场景里很常见：

**Toast/notification 系统**：`toast.show(msg)` 是全局函数，但实际渲染由 React 组件处理。组件挂载时注册 setter，`toast.show` 内部调用这个 setter 触发渲染。

**Analytics 桥**：`analytics.track('event')` 是全局函数，对应的 React 上下文（用户 ID、当前 session）在组件里。组件把这些上下文注册给 analytics，全局函数在调用时附加上下文。

**第三方 SDK 集成**：很多第三方 SDK（支付、地图）提供全局初始化后的对象，React 组件要和这些对象交互，常常通过类似的注册模式打通。

这个模式的共同特征：**需要在 React 组件树之外调用 React 状态更新**，同时又不想引入重量级的全局状态管理库。

## 面试怎么答

如果面试题是"如何在 React 组件外部安全地更新 React 状态"：

**不推荐的方案**：把 setter 存到 `window.myGlobalSetter`。这没有类型，没有生命周期管理，是真正的随意全局变量。

**可接受的方案**：模块级变量 + 注册/注销。有类型，有生命周期，有 null 检查。

**最佳实践补充**：结合 `useEffect` cleanup 确保组件卸载时注销，结合 null 检查确保调用方有正确的回退逻辑。这两点让"全局变量"从危险变成可控。

**设计原则**：跨层接口的宽度决定了两层之间的耦合程度。接口越窄（只暴露两个 setter），两层的独立性越高，修改一层对另一层的影响越小。不要为了使用方便而把接口开大，开大的代价是两层开始相互依赖，变成一层。
