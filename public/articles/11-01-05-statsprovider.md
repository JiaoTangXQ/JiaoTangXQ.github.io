---
title: "可测试性设计：「自带电池」模式为什么比强制注入更务实？StatsProvider 案例"
slug: "11-01-05-statsprovider"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# 可测试性设计：「自带电池」模式为什么比强制注入更务实？StatsProvider 案例

依赖注入（DI）是个好原则，但走极端会变成负担：每次创建组件都要传一堆依赖，连最简单的用法也要先 mock 一遍。

Claude Code 的 `StatsProvider` 用一个「可选参数 + 自带电池」的模式找到了平衡点。

---

## StatsProvider 的双模式实现

```tsx
export function StatsProvider({ store: externalStore, children }) {
  const internalStore = useMemo(() => createStatsStore(), [])
  const store = externalStore ?? internalStore

  // ... 使用 store 做统计
}
```

这六行代码包含了完整的设计逻辑：

- `externalStore` 是可选的（参数名有 `: externalStore` 解构别名提示这是外来的）
- 没有传就用 `useMemo` 创建内部的
- 外部优先（`??` 操作符：只有外部为 null/undefined 时才用内部的）

调用方既可以：

```tsx
// 生产用法：不传，用内部创建的
<StatsProvider>
  {children}
</StatsProvider>

// 测试用法：注入精确控制的 mock
<StatsProvider store={mockStatsStore}>
  {children}
</StatsProvider>
```

---

## 为什么不直接强制要求外部传入？

如果 API 设计成这样：

```tsx
// 强制注入版本
<StatsProvider store={statsStore}>
```

那么每一个渲染 `App` 的地方都需要先创建一个 `statsStore` 实例传进来。这意味着：

1. 生产代码里 `ink.ts` 的调用方（实际的应用启动点）需要显式创建和管理 `statsStore` 的生命周期
2. 每次写测试都要先 mock `statsStore`，哪怕这个测试根本不关心统计

第二点是主要的痛点。如果一个测试只是想验证某个按键行为是否正确，它不应该被迫先搭建一个完整的统计基础设施。

---

## 「自带电池」不等于「无法测试」

这个模式经常被误解：「自带电池」看起来像是把依赖藏起来了，测试时怎么验证统计行为？

答案是：需要验证统计行为的测试，才注入 mock。不关心统计的测试，用默认的内部 store 就行。

```tsx
// 只测 UI 行为的测试：不传 stats
test('按下 Esc 关闭对话框', () => {
  render(
    <App getFpsMetrics={noop} initialState={testState}>
      <SomeDialog />
    </App>
  )
  // ...
})

// 验证统计记录的测试：注入 mock
test('完成任务时记录 task_complete 指标', () => {
  const mockStore = createMockStatsStore()
  render(
    <App getFpsMetrics={noop} stats={mockStore} initialState={testState}>
      <TaskComponent />
    </App>
  )
  completeTask()
  expect(mockStore.get('task_complete')).toBe(1)
})
```

---

## createStatsStore 的内部实现

自带电池好用的前提是内部实现足够健壮。`createStatsStore` 不是随手写的计数器：

```ts
// stats.ts（概念还原版）
export function createStatsStore(): StatsStore {
  const metrics = new Map<string, number>()
  const histograms = new Map<string, number[]>()  // Reservoir sampling
  const sets = new Map<string, Set<string>>()
  
  return {
    increment(key: string, by = 1) {
      metrics.set(key, (metrics.get(key) ?? 0) + by)
    },
    
    recordHistogram(key: string, value: number) {
      // Algorithm R — 等概率水塘采样
      const samples = histograms.get(key) ?? []
      if (samples.length < SAMPLE_SIZE) {
        samples.push(value)
      } else {
        const idx = Math.floor(Math.random() * (samples.length + 1))
        if (idx < SAMPLE_SIZE) samples[idx] = value
      }
      histograms.set(key, samples)
    },
    
    addToSet(key: string, value: string) {
      const s = sets.get(key) ?? new Set<string>()
      s.add(value)
      sets.set(key, s)
    },
    
    getAll() {
      // 聚合所有数据并返回
    }
  }
}
```

三种数据结构：

- **metrics**：简单计数器，用于记录次数（任务完成次数、工具调用次数）
- **histograms**：用 Reservoir Sampling（Algorithm R）维护等概率样本，用于延迟、token 数量等分布数据
- **sets**：记录不重复项目，用于统计唯一工具用了哪些、唯一文件被改了哪些

Reservoir Sampling 是统计学里的经典算法：不需要知道总样本量，能在内存有限的情况下维持等概率采样。Claude Code 在这里用的是工业级方案，不是玩具。

---

## useMemo 的选择而不是 useRef

```tsx
const internalStore = useMemo(() => createStatsStore(), [])
```

为什么用 `useMemo` 而不是 `useRef`？

两者在这里效果等同：都是只在第一次渲染时创建，之后复用。差别在于语义：

- `useMemo(() => createStatsStore(), [])` 表达「这是一个记忆化计算值，依赖为空意味着只算一次」
- `useRef(createStatsStore())` 表达「这是一个持久的可变容器」

`store` 是个不可变身份（创建后不替换），但内容会变（stats 会被更新）。两种写法都能工作，`useMemo` 的语义稍微清晰一点。

---

## 面试指导

**「自带电池 + 可选注入」适合哪些场景？**

适合以下特征的依赖：
- 大多数使用方不关心它的具体实现（只有少数测试需要精确控制）
- 有一个合理的默认实现（不是 noop，而是真正能工作的实现）
- 替换实现不改变接口契约

不适合：安全相关的依赖（认证、加密）——这类依赖必须强制注入，不能有「默认实现」的侥幸心理。

**可选参数和默认参数有什么区别？**

可选参数（`store?`）意味着不传就是 `undefined`，组件自己决定怎么处理 undefined。默认参数（`store = createStatsStore()`）意味着每次调用时如果不传，就会执行 `createStatsStore()` 创建一个新实例——这在 React 函数组件里是危险的，每次渲染都会创建新实例。`useMemo` 解决了这个问题。
