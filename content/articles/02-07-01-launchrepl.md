---
title: "为什么 AppWrapperProps 里有 getFpsMetrics 这么奇怪的东西？"
slug: "02-07-01-launchrepl"
date: 2026-04-09
topics: [工作台架构, 启动]
summary: "launchRepl() 接受一个 AppWrapperProps 参数，里面有 getFpsMetrics、stats、initialState。为什么这些东西要在启动时传入？它们解决了什么问题？"
importance: 1
---

# 为什么 AppWrapperProps 里有 getFpsMetrics 这么奇怪的东西？

## 函数签名里的奇怪参数

```typescript
type AppWrapperProps = {
  getFpsMetrics: () => FpsMetrics | undefined;
  stats?: StatsStore;
  initialState: AppState;
};

export async function launchRepl(
  root: Root,
  appProps: AppWrapperProps,
  replProps: REPLProps,
  renderAndRun: (root: Root, element: React.ReactNode) => Promise<void>
): Promise<void>
```

`getFpsMetrics`——帧率指标获取函数——出现在 `launchRepl()` 的参数里。

这看起来和"启动 REPL"没什么直接关系。为什么要在这个函数调用点传入？

## FPS 指标：在首屏渲染之前就要开始测量

FPS（frames per second）指标用于测量 React 组件的渲染性能。如果某个操作导致 UI 卡顿（帧率下降），FPS 指标可以帮助定位问题。

关键问题：要测量首屏的帧率，必须在首屏渲染**开始之前**就启动测量。如果等到 `App` 组件初始化完再启动 FPS 测量，就已经错过了最初始的渲染阶段。

所以在 `main.tsx` 里，FPS 追踪器在 `launchRepl()` 调用之前就已经启动了：

```typescript
// main.tsx（简化）
const fpsTracker = startFpsTracker();
// ...
await launchRepl(root, {
  getFpsMetrics: () => fpsTracker.getMetrics(),
  stats: statsStore,
  initialState: appState,
}, replProps, renderAndRun);
```

`getFpsMetrics` 是一个 getter，而不是直接的指标值——这样 `App` 组件在任何时间点都可以读取最新的帧率数据，而不是只能读到调用 `launchRepl()` 时那一刻的快照。

## initialState：为什么在启动时传入而不是在内部构建？

```typescript
type AppWrapperProps = {
  // ...
  initialState: AppState;  // ← 整个应用初始状态
};
```

`AppState` 包含了：当前会话 ID、permission mode、工作目录、模型设置、feature flags 状态等几十个字段。

这些状态为什么不在 `App` 组件内部构建，而是从外部传入？

**原因：状态构建依赖于 setup() 已经完成**

`initialState` 是在 `main.tsx` 里、`setup()` 和 `showSetupScreens()` 之后构建的：

```typescript
// setup() 完成后
const initialState = getDefaultAppState({
  sessionId: getSessionId(),
  cwd: getCwd(),                  // 来自 setup() 设置的 cwd
  permissionMode: parsedPermMode,
  isInteractive: true,
  // ... 其他来自 setup() 的状态
});

await launchRepl(root, { initialState, ... }, replProps, renderAndRun);
```

如果在 `App` 组件内部构建 `initialState`，它就必须知道 `setup()` 完成后的各种全局状态，导致 `App` 组件耦合到启动流程的细节。

把状态从外部传入，`App` 组件只需要"接受一个 initialState，渲染它"，对"这些状态从哪里来"保持无知。

## stats StatsStore：性能统计的轻量委托

```typescript
stats?: StatsStore  // 可选
```

`StatsStore` 是一个性能统计收集器，用于记录 API 调用时间、token 使用量等指标。

它是可选的（`?`），意味着在某些启动路径（比如测试或轻量模式）下，可以不传入统计收集器，减少开销。

同样，这个对象在 `App` 初始化之前就创建好了：

```typescript
const statsStore = createStatsStore();
// ...注册到全局状态...
await launchRepl(root, { stats: statsStore, ... }, ...);
```

## 这个设计说明了什么？

`launchRepl()` 和 `App` 组件是"消费者"，它们接受已经准备好的状态，而不是自己构建状态。

这是一个经典的依赖注入原则：
- 把"如何构建状态"的逻辑放在 `main.tsx`（启动逻辑层）
- 把"如何使用状态"的逻辑放在 `App`/`REPL`（UI 层）
- 通过函数参数连接两者

优点：
- UI 组件可以单独测试（传入 mock initialState 就可以）
- 启动逻辑可以单独测试（不需要渲染 UI 就能验证状态构建是否正确）
- 两者之间的接口（`AppWrapperProps`）是清晰的边界

## 面试指导

`getFpsMetrics` 这个看起来奇怪的参数，实际上体现了一个重要的设计原则：**测量代码和被测量代码必须分离**。

如果帧率测量在 `App` 组件内部启动，就只能测量"App 初始化之后"的帧率。如果想测量"App 初始化本身"的帧率，测量必须在外部启动，然后把测量句柄传入。

这类"测量仪器从外部注入"的设计在可观测性工程里很常见：tracing、metrics、profiling 的代码往往不在被测对象内部，而是从外部注入，这样被测对象保持干净，测量代码可以在任意时机启动。

能识别这个模式并说出其意义，是展示软件设计理解深度的好机会。
