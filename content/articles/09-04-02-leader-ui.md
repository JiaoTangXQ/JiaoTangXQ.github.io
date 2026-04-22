---
title: "leaderPermissionBridge.ts 全文只有 55 行，却是整套权限系统的关键枢纽"
slug: "09-04-02-leader-ui"
date: 2026-04-09
topics: [多Agent协作]
importance: 1
---

# leaderPermissionBridge.ts 全文只有 55 行，却是整套权限系统的关键枢纽

`leaderPermissionBridge.ts` 的完整内容：

```typescript
let registeredSetter: SetToolUseConfirmQueueFn | null = null
let registeredPermissionContextSetter: SetToolPermissionContextFn | null = null

export function registerLeaderToolUseConfirmQueue(setter: SetToolUseConfirmQueueFn): void {
  registeredSetter = setter
}

export function getLeaderToolUseConfirmQueue(): SetToolUseConfirmQueueFn | null {
  return registeredSetter
}

export function unregisterLeaderToolUseConfirmQueue(): void {
  registeredSetter = null
}

// ... 另外三个对称的 register/get/unregister 函数
```

55 行，两对模块级变量，六个函数。这就是 Claude Code 整个权限桥的实现。

## 为什么需要这个桥

问题的根源是 React 的渲染模型。

React 组件树里的状态更新只能通过 `useState` 的 setter 函数。但 `inProcessRunner.ts` 是 TypeScript 的普通异步代码，不是 React 组件，它无法直接访问 React 的状态。

传统的解法是把状态提升到某个共享 context，然后通过 React Context API 向下传递。但 `inProcessRunner.ts` 根本不在 React 的组件树里——它运行在 React 渲染循环之外的异步执行上下文中。

另一个传统解法是全局状态管理库（Redux、Zustand 等），它们可以在 React 外部被调用。但引入状态管理库只为了打通这一个接口，成本太高，也引入了不必要的依赖。

`leaderPermissionBridge.ts` 的方案：**让 React 组件主动把自己的 setter 注册到一个模块级变量，非 React 代码通过这个变量间接调用 setter**。

这是一种受控的全局状态，不是随意的全局变量——它有明确的注册和注销协议，有类型约束，有生命周期管理。

## 为什么只暴露两个 setter

桥上只有两个 setter：

1. `SetToolUseConfirmQueueFn`：往权限确认队列里推请求
2. `SetToolPermissionContextFn`：更新权限上下文（比如当 worker 被授权某个 always-allow 规则时）

为什么不多暴露一些？比如：直接访问 AppState、访问消息历史、访问当前用户信息……

这涉及一个接口设计原则：**跨层接口应该只暴露确实需要跨越的那部分，而不是把整个内部状态都开放出去**。

如果把 AppState 完整暴露给 `inProcessRunner.ts`，那 runner 就可以做任何 React 组件能做的事情——更新消息历史、修改用户设置、触发路由跳转……这些能力在技术上可行，但会造成严重的架构污染：执行循环（本应只关心工具调用和 AI 响应）开始依赖 UI 状态，两层之间的边界模糊，后续维护成本急剧上升。

窄接口强制要求跨层调用方只做最少的事：**你只能推一个权限请求，你只能更新权限上下文**，其他事情不归你管。

这不是技术限制，而是架构约束——主动限制自己能做什么，防止"能做"变成"随便做"。

## 对称的生命周期管理

每个 register 函数都对应一个 unregister：

```typescript
export function registerLeaderToolUseConfirmQueue(setter): void
export function unregisterLeaderToolUseConfirmQueue(): void
```

为什么注销这么重要？

React 组件挂载时调用 `registerLeaderToolUseConfirmQueue(setConfirmQueue)`，把 setter 存到模块级变量里。这个 setter 是一个闭包，它持有对 React 组件内部状态的引用。

如果 REPL 组件卸载了（比如用户关闭了某个视图，或者 React 重新渲染时卸载了旧实例），但没有调用 unregister，模块级变量里还存着那个旧的 setter，指向一个已经销毁的组件实例。

下次 `inProcessRunner.ts` 调用这个 setter，行为是未定义的——可能调用已销毁组件的 setState（在 React 18 之前会有 warning，之后会被忽略），可能触发 closure 捕获的已失效的引用，可能造成内存泄漏（组件无法被 GC，因为全局变量还引用着它的 setter）。

对称的 unregister 防止了这一切：React 组件在 `useEffect` 的清理函数里调用 unregister，保证组件生命周期和桥的生命周期绑定。

## 模块级变量的测试挑战

模块级变量有一个众所周知的测试问题：测试之间会互相污染状态。

如果测试 A 注册了一个 setter，测试 B 开始时这个 setter 还在。

Claude Code 通过两种方式缓解这个问题：

1. `unregister` 函数存在且可以在 test teardown 里调用
2. 所有调用 `getLeaderToolUseConfirmQueue()` 的代码都检查 null，所以即使桥没有被注册，系统不会崩溃，只会走回退路径

这是一个实用主义的权衡：接受模块级变量的局限性，通过对称的生命周期管理和 null 检查来降低风险，而不是为了测试纯粹性引入更复杂的依赖注入机制。

## 面试怎么答

如果面试题是"如何在 React 的 UI 层和非 React 的执行层之间安全地通信"：

**过度设计的方案**：引入全局状态管理库（Redux），在两层之间用 pub/sub 模式通信。这能工作，但引入了大量间接层。

**欠设计的方案**：在 React 组件里 export 一个全局可访问的对象，包含所有状态和 setter。非 React 代码随意调用。这让两层之间没有任何边界。

**Claude Code 的方案**：模块级变量 + 最小接口 + 对称生命周期。只暴露确实需要跨层调用的能力，不多不少；用注册/注销协议管理生命周期，防止 stale reference；返回 nullable，强制调用方处理"桥不存在"的情况。

**加分项**：这个模式在其他场景里也有对应——比如 analytics 系统里 `window.analytics.track()`，是由第三方脚本注册的全局函数，业务代码通过调用这个函数发送事件，但不依赖这个函数一定存在（会有 if-check）。这和 leaderPermissionBridge 的结构是同构的：可选的全局接口，有则用，无则退。
