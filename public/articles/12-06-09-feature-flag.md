---
title: "安全分析：shouldAutoEnableClaudeInChrome() 的三道门控是如何做渐进式发布的？"
slug: "12-06-09-feature-flag"
date: 2026-04-09
topics: [外延执行]
summary: "shouldAutoEnableClaudeInChrome() 要求同时满足：交互式会话、扩展已安装、以及 ant 用户身份或 feature flag 放行。这三道门控不是多余的，而是一套针对高风险能力的渐进式发布机制：先在内部用户中验证，再通过 feature flag 逐步向外部用户推开。"
importance: 1
---

# 安全分析：shouldAutoEnableClaudeInChrome() 的三道门控是如何做渐进式发布的？

## Feature Flag 在高风险能力发布中的作用

Feature flag（特性开关）是现代软件工程里的标准工具，用于：
1. 渐进式发布（逐步向用户推开）
2. A/B 测试
3. 紧急回滚（出了问题立刻关掉）
4. 环境区分（内部测试 vs 外部发布）

但 feature flag 的粒度和应用场景很关键。给每个小功能都加 feature flag 会让代码变得难以维护，给重要功能加 feature flag 则可以显著降低发布风险。

Claude in Chrome 的自动启用是一个典型的"高风险功能"候选：
- 它会主动读取用户的浏览器状态
- 它在用户没有明确要求时自动开启
- 一旦出了问题，影响用户的实际工作

这类功能非常适合用 feature flag 做渐进式发布。

## shouldAutoEnableClaudeInChrome() 的三道门

```ts
let shouldAutoEnable: boolean | undefined = undefined

export function shouldAutoEnableClaudeInChrome(): boolean {
  if (shouldAutoEnable !== undefined) { return shouldAutoEnable }

  shouldAutoEnable =
    getIsInteractive() &&                          // 门一：必须是交互会话
    isChromeExtensionInstalled_CACHED_MAY_BE_STALE() &&  // 门二：扩展必须已安装
    (process.env.USER_TYPE === 'ant' ||            // 门三：ant 用户（内部）
      getFeatureValue_CACHED_MAY_BE_STALE('tengu_chrome_auto_enable', false))  // 或 feature flag 放行

  return shouldAutoEnable
}
```

**第一道门：交互式会话**

非交互环境（SDK、CI、print mode）不自动启用。这道门是最基础的安全网，防止浏览器能力在不应该出现的场景里悄悄启动。

**第二道门：扩展已安装**

如果用户没有安装 Chrome 扩展，自动启用毫无意义——连接会立刻失败。这道门避免了无意义的初始化和失败日志。

**第三道门：内部用户或 feature flag**

这是真正的发布控制门：
- `USER_TYPE === 'ant'`：Anthropic 内部员工账号，直接放行
- `getFeatureValue_CACHED_MAY_BE_STALE('tengu_chrome_auto_enable', false)`：外部用户通过 Growthbook feature flag 控制，默认 `false`

## 渐进式发布的工作流程

这种设计对应的发布流程：

**阶段一：内部测试**
- feature flag `tengu_chrome_auto_enable` 处于 `false`
- 只有 `ant` 用户自动启用
- 收集使用数据和 bug 报告

**阶段二：小批量外部发布**
- 通过 Growthbook 把 `tengu_chrome_auto_enable` 对 10% 用户设为 `true`
- 观察错误率和用户反馈
- 如果有问题，立刻把 flag 关回 `false`，问题立刻消失

**阶段三：全量发布**
- 把 flag 设为对所有用户 `true`
- 或者改代码，把这个条件变成默认 `true`，删除 flag

这种发布流程比"一次性全量发布"安全得多，出了问题的爆炸半径可控。

## getFeatureValue_CACHED_MAY_BE_STALE 的命名

注意函数名：`getFeatureValue_CACHED_MAY_BE_STALE`。

这个命名规范（`_CACHED_MAY_BE_STALE` 后缀）是 Claude Code 里的一种惯例，用来标记"这个值来自缓存，可能不是最新的"。

对于启动时决定的值（自动启用是否开启），使用缓存的 feature flag 值是合理的：
- Growthbook 的 feature flag 更新不是实时的
- 在进程启动时读取一次，整个进程生命周期里使用，避免频繁的网络请求
- 即使值有一点延迟，影响也只是"自动启用比预期晚几次"，不是关键路径

## 面试考察点

这道题考察的是**Feature Flag 的实际工程应用**和**渐进式发布策略**。

在面试中，关于"如何发布一个高风险功能"，一个成熟的回答应该包括：

1. **识别风险**：什么使这个功能"高风险"？（自动行为、访问敏感资源、影响用户真实工作环境）

2. **设计发布梯队**：内部 → 小批量外部 → 全量。每个阶段的成功标准是什么？

3. **回滚机制**：Feature flag 关掉后，功能立刻恢复到发布前状态，不需要重新部署

4. **监控指标**：怎么知道功能工作正常？（连接成功率、用户报告的错误率、特定错误码的出现频率）

Claude Code 的三道门控设计，是这些考虑在代码层面的具体实现。

