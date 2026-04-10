---
title: "面试题：FPS 监控用 getter 而不是 state，这个设计规避了什么物理学问题？"
slug: "11-01-07-fpsgetter"
date: 2026-04-09
topics: [终端界面]
summary: "把 FPS 放进 AppState 会制造一个悖论：为了观察界面性能，反而让界面变慢。FPS 的 getter 模式是规避 Observer Effect 的工程解法。理解这个模式，能加深对 React 渲染机制的认识。"
importance: 1
---

# 面试题：FPS 监控用 getter 而不是 state，这个设计规避了什么物理学问题？

量子力学里有个「观测者效应」（Observer Effect）：观察粒子的行为本身会改变粒子的状态。

软件工程里有个对应物：**测量系统的开销本身影响被测量的系统**。

Claude Code 的 FPS 监控设计，是一个对这个问题的工程级回答。

---

## 如果 FPS 走 AppState 会发生什么

设想这样的实现：

```ts
// 假想的「天真」实现
type AppState = {
  // ... 业务字段
  currentFps: number
}

// 在某个高层组件里定期更新
useEffect(() => {
  let frameCount = 0
  let lastTime = performance.now()
  
  const measure = () => {
    frameCount++
    const now = performance.now()
    if (now - lastTime >= 1000) {
      const fps = frameCount / ((now - lastTime) / 1000)
      // 每秒更新一次 AppState
      setAppState(prev => ({ ...prev, currentFps: fps }))
      frameCount = 0
      lastTime = now
    }
    requestAnimationFrame(measure)
  }
  
  const rafId = requestAnimationFrame(measure)
  return () => cancelAnimationFrame(rafId)
}, [])
```

表面看：每秒只更新一次，应该不会太慢。

实际问题：

**1. 每次 `setAppState` 触发所有 AppState 订阅者的 selector 计算**

假设有 30 个组件订阅了不同的 AppState 字段。每次 `currentFps` 更新，这 30 个组件的 selector 都会被调用一次（用来检查自己关心的字段有没有变化）。大多数 selector 会返回「没变化」，组件不会重渲染，但 selector 调用本身的开销已经发生了。

**2. 被测量的系统是 React 渲染本身**

FPS 指标测量的是 React 组件的渲染帧率。但更新 `currentFps` 这个动作本身就是一次 AppState 变化，会触发 React 进行一轮更新。这意味着：

> 为了测量渲染帧率，我们额外触发了一轮渲染。

这就是软件版本的 Observer Effect：观察行为本身影响了被观察的指标。

---

## getter 模式如何绕过这个问题

Claude Code 的实际实现：

```tsx
// Context 存的是函数，不是数值
const FpsMetricsContext = createContext<(() => FpsMetrics | undefined) | undefined>(undefined)

export function FpsMetricsProvider({ getFpsMetrics, children }) {
  // Context value 永远是同一个函数引用（从外部传入，稳定）
  return (
    <FpsMetricsContext.Provider value={getFpsMetrics}>
      {children}
    </FpsMetricsContext.Provider>
  )
}
```

`getFpsMetrics` 是一个函数，函数引用是稳定的。Context value 不变，所以这个 Context 的变化**永远不会触发任何重渲染**。

FPS 的实际数值存在 Provider 之外的某个数据结构里（比如一个 ref 或模块级变量），由 `requestAnimationFrame` 回调持续更新，但这个更新完全绕过了 React 的更新机制。

组件需要 FPS 时：

```ts
export function useFpsMetrics() {
  return useContext(FpsMetricsContext)  // 返回 getter 函数
}

// 在需要的地方
const getFps = useFpsMetrics()
const devBar = () => {
  const metrics = getFps?.()  // 主动拉取
  return <DevBar fps={metrics?.currentFps} />
}
```

这是**拉取（pull）**模式：消费者在自己想要数据的时候主动取。不存在 FPS 数值更新 → 组件重渲染这条链路。

---

## 推送 vs 拉取的适用场景

**推送（push）适合的场景**：
- 数据变化需要立即反映到 UI 上（用户操作的结果、新消息到达）
- 消费者需要响应数据变化而不只是读取当前值
- 数据变化驱动业务行为

**拉取（pull）适合的场景**：
- 数据高频变化，但大多数变化对 UI 没有意义（帧率、时间戳）
- 消费者只在特定时机需要数据（用户打开某个面板、Debug 模式下）
- 观测数据不驱动业务行为

FPS 完全符合「拉取」的场景：它高频变化，但正常使用时界面上不展示 FPS；只有打开 DevBar 的时候才需要读取，而 DevBar 自己控制读取频率，不需要 FPS 来驱动重渲染。

---

## 这不是 FPS 独有的，是一类问题

很多监控类数据都适合 getter 模式：

- 内存使用量（高频，但不驱动业务）
- 当前时间戳（每毫秒变化，但只在需要时读取）
- 网络延迟（持续测量，但只在展示时读取）
- 电池电量（操作系统级别，不需要进入 React 状态系统）

反例：用户身份信息不适合 getter 模式——用户登出时，所有依赖身份的 UI 都应该立即更新，这需要推送。

---

## 面试指导

**这个模式在 React 文档里有对应内容吗？**

React 官方文档里有「订阅外部 store」的模式（`useSyncExternalStore`），FPS 的 getter 模式是更轻量的版本——不订阅任何东西，只在需要时读取，牺牲「响应式」换「零开销」。

**DevBar 里展示 FPS 时不会有延迟吗？**

会有。`getFps?.()` 返回的是上次测量时记录的快照值，不是「此刻的帧率」。但对于 DevBar 这种调试工具，展示 1 帧以内的延迟数据完全可以接受——它本来就是历史数据的展示，不是实时流。

**如果要做「FPS 低于 30 时展示警告」，怎么实现？**

不能用纯 getter 模式——警告需要响应 FPS 变化。一种做法：在 FPS 采集层（`requestAnimationFrame` 回调里）检测阈值，如果超过阈值则通过 `setAppState` 设置一个 `shouldShowFpsWarning: boolean`。把「原始 FPS 数值」和「业务级判断结论」分开：数值用 getter 存，判断结论才进 AppState。
