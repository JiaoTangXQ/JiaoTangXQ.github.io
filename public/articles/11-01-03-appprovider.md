---
title: "工程取舍：入口文件应该「做什么」？App.tsx 的极度克制背后是什么原则？"
slug: "11-01-03-appprovider"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# 工程取舍：入口文件应该「做什么」？App.tsx 的极度克制背后是什么原则？

一个架构问题：你项目的入口文件有多少行？

有些项目的 `App.tsx` 或 `main.ts` 会在入口层做大量工作：初始化路由、配置错误边界、处理 loading 状态、做环境判断、初始化第三方 SDK……结果入口文件越来越肥，越来越难读。

Claude Code 的 `App.tsx` 走了另一个极端。

---

## App.tsx 几乎什么都不做

还原后的代码：

```tsx
export function App({ getFpsMetrics, stats, initialState, children }) {
  return (
    <FpsMetricsProvider getFpsMetrics={getFpsMetrics}>
      <StatsProvider store={stats}>
        <AppStateProvider
          initialState={initialState}
          onChangeAppState={onChangeAppState}
        >
          {children}
        </AppStateProvider>
      </StatsProvider>
    </FpsMetricsProvider>
  )
}
```

这个函数做了什么：

1. 接收 5 个参数
2. 把这些参数分发给对应的 Provider
3. 渲染 children

没有条件判断，没有 useEffect，没有本地状态，没有错误处理。纯粹的装配。

---

## 「入口做装配，不做决策」是什么原则

这条原则的核心逻辑是：**入口层能看到所有子系统，但不应该理解任何子系统的内部**。

如果 `App.tsx` 开始做决策，比如：

```tsx
// 反例：入口层不应该这样做
export function App({ getFpsMetrics, stats, initialState }) {
  const [fpsWarning, setFpsWarning] = useState(false)
  
  useEffect(() => {
    const metrics = getFpsMetrics()
    if (metrics && metrics.avgFps < 30) {
      setFpsWarning(true)
    }
  }, [getFpsMetrics])

  return (
    <FpsMetricsProvider getFpsMetrics={getFpsMetrics}>
      {fpsWarning && <PerformanceWarning />}
      {/* ... */}
    </FpsMetricsProvider>
  )
}
```

问题出现了：`App.tsx` 现在知道了 FPS 低于 30 意味着警告。这是 FPS 系统的业务逻辑，不应该泄漏到入口层。

如果 FPS 警告的阈值要改，你要去改 `App.tsx`。如果要把这个逻辑复用到别处，你无法单独提取，因为它混在入口里。

---

## 所有决策都被压进了各自的子系统

`App.tsx` 不判断 FPS 阈值。这个判断在 `FpsMetricsProvider` 内部或其消费者里。

`App.tsx` 不处理 stats 落盘时机。这在 `StatsProvider` 的 `useEffect` 里（`process.on('exit', flush)`）。

`App.tsx` 不处理权限模式初始化。这在 `AppStateProvider` 挂载后的 `useEffect` 里——如果 bypass 权限模式已被禁用，就立刻纠正状态。

`App.tsx` 不处理设置变化同步。这在 `AppStateProvider` 里通过 `useSettingsChange` 完成。

入口知道这些事情**存在**，但不知道这些事情**怎么做**。

---

## 参数是接口契约，不是实现细节

`App.tsx` 接受的五个参数都是接口，不是实现：

- `getFpsMetrics` — 一个可以返回 FPS 数据的函数，不关心数据怎么采集
- `stats` — 一个 StatsStore，不关心它背后是什么存储
- `initialState` — 一个 AppState 对象，不关心它从哪里来
- `onChangeAppState` — 一个回调，不关心它里面做什么
- `children` — 一棵 React 树，完全不透明

这些参数的共同特征是：`App.tsx` 只负责把它们分发到正确的位置，不需要理解它们的内容。

---

## 这种设计的可测试性收益

当 `App.tsx` 只做装配时，测试它变得非常简单：

```tsx
// 测试时可以随意注入
render(
  <App
    getFpsMetrics={() => ({ avgFps: 60, minFps: 55 })}
    stats={createMockStatsStore()}
    initialState={testInitialState}
    onChangeAppState={jest.fn()}
  >
    <TestComponent />
  </App>
)
```

想测试 FPS 警告逻辑？去测试 `FpsMetricsProvider` 和它的消费者。想测试统计落盘？去测试 `StatsProvider`。`App.tsx` 本身的测试只需要验证：三个 Provider 有没有被正确渲染，参数有没有被正确传递。

---

## 反模式对比：有多少入口文件是这样的

```tsx
// 典型的「入口文件过载」反模式
export function App() {
  const theme = useSystemTheme()
  const locale = useUserLocale()
  const [authToken, setAuthToken] = useState(null)
  const [isInitialized, setIsInitialized] = useState(false)
  
  useEffect(() => {
    initializeAnalytics()
    loadUserPreferences()
    checkAuthStatus().then(token => {
      setAuthToken(token)
      setIsInitialized(true)
    })
  }, [])

  if (!isInitialized) return <LoadingScreen />

  return (
    <ThemeProvider theme={theme}>
      <I18nProvider locale={locale}>
        <AuthProvider token={authToken}>
          <Router>
            {/* ... */}
          </Router>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}
```

这个 `App` 知道了太多：初始化时序、认证状态、loading UI。每加一个需求，入口文件就胖一圈。

---

## 面试指导

**怎么判断入口文件是否职责过重？**

简单标准：入口文件里有多少个 `useState` 和 `useEffect`？如果多于一个，就值得想一想这些逻辑是否应该被推进子系统里。

**极度克制的代价是什么？**

代价是：代码跳转路径变长了。当你想知道「初始化时到底发生了什么」，你需要进入每个 Provider 内部去查。入口文件不是快速了解系统的地方，而是系统的分发点。这是一个有意的取舍——可维护性优先于可读性入口。

**什么情况下可以在入口层做更多事？**

如果子系统之间的初始化有严格的时序依赖——比如 Analytics 必须在 Auth 之后初始化——那么入口层协调这个时序是合理的。但应该把「时序协调」和「业务逻辑」分开。协调逻辑写在入口，业务逻辑不行。
