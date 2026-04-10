---
title: "preAction 钩子里按什么顺序执行了哪些操作？"
slug: "02-03-02-preaction"
date: 2026-04-09
topics: [工作台架构, 启动]
summary: "逐步追踪：当用户执行 `claude` 进入 REPL，preAction 钩子触发后，代码按什么顺序执行了什么？每一步的前置依赖是什么？"
importance: 1
---

# preAction 钩子里按什么顺序执行了哪些操作？

`preAction` 钩子触发后，到真正进入 `setup()` 和 REPL 启动之前，有一段密集的初始化序列。把这段顺序写清楚，几乎就是在写一份"启动检查清单"。

## 步骤 1：`init()` — 环境基础设施

`init()` 在 `entrypoints/init.ts` 里，用 `memoize` 包裹保证只执行一次。

内部顺序（有严格的因果约束）：

```
enableConfigs()                      // 启动配置系统
  ↓
applySafeConfigEnvironmentVariables() // 应用"安全"环境变量（trust 之前允许的部分）
  ↓
applyExtraCACertsFromConfig()         // 补充 CA 证书（必须在第一次 TLS 之前）
  ↓
setupGracefulShutdown()               // 注册进程退出处理
  ↓
void 1P event logging init            // 异步：不阻塞
void populateOAuthAccountInfoIfNeeded // 异步：不阻塞
void initJetBrainsDetection           // 异步：不阻塞
void detectCurrentRepository          // 异步：不阻塞
  ↓
initializeRemoteManagedSettingsLoadingPromise() // 建立远端设置加载 promise
initializePolicyLimitsLoadingPromise()           // 建立 policy 限制加载 promise
  ↓
recordFirstStartTime()               // 记录首次启动时间
  ↓
configureGlobalMTLS()                // mTLS 配置（必须在代理之前）
  ↓
configureGlobalAgents()              // 代理配置（必须在 API 预连接之前）
  ↓
preconnectAnthropicApi()             // TCP 预热（在正确 transport 配置之后）
  ↓
setShellIfWindows()                  // Windows shell 设置
  ↓
registerCleanup(shutdownLspServerManager) // 注册清理器
  ↓
ensureScratchpadDir()                // 创建 scratchpad 目录（如果启用）
```

注意几个关键约束：
- CA 证书必须在任何 TLS 握手之前配置（Bun 缓存 TLS cert store 在 BoringSSL）
- 代理必须在 API 预连接之前配置（否则预热的连接用了错误的 transport）
- 远端设置 promise 在 init 阶段只是"建立"，不是"等待"——真正等待在 trust 确认之后

## 步骤 2：`initializeTelemetryAfterTrust()`

```typescript
export function initializeTelemetryAfterTrust(): void {
  if (isEligibleForRemoteManagedSettings()) {
    void waitForRemoteManagedSettingsToLoad()
      .then(async () => {
        applyConfigEnvironmentVariables()  // 完整环境变量（非 safe-only）
        await doInitializeTelemetry()
      })
  } else {
    void doInitializeTelemetry()
  }
}
```

这个函数是异步链的起点，不阻塞 preAction 的后续执行。它的存在确保了：
- 对于有远端设置的用户，telemetry 在远端设置加载完后初始化（确保设置里的 telemetry 配置生效）
- 对于普通用户，立即初始化

## 步骤 3：迁移执行

```typescript
function runMigrations(): void {
  if (getGlobalConfig().migrationVersion !== CURRENT_MIGRATION_VERSION) {
    migrateAutoUpdatesToSettings();
    migrateBypassPermissionsAcceptedToSettings();
    // ...7 个迁移函数
    saveGlobalConfig(prev => ({...prev, migrationVersion: CURRENT_MIGRATION_VERSION}));
  }
  // 异步迁移：fire-and-forget
  migrateChangelogFromConfig().catch(() => {});
}
```

`CURRENT_MIGRATION_VERSION = 11`，每次添加新迁移时递增。迁移函数都是幂等的——多次执行结果相同。

为什么这里执行而不是更早？因为迁移会修改配置文件，而配置文件在 `init()` 的 `enableConfigs()` 之后才可以安全读写。

## 步骤 4：设置过程标题

```typescript
process.title = 'claude';
```

这是小事，但有意义——`ps` 列表里的进程名会显示为 `claude` 而不是 `node` 或 `bun`。

## preAction 之后是什么？

preAction 钩子完成后，控制权回到 Commander，Commander 调用注册的命令 action 函数。

对于主命令（`claude` 不带子命令），action 函数里会继续执行：

```
setup()          // 工作现场初始化
showSetupScreens() // Trust/onboarding 界面
launchRepl()     // REPL 启动
startDeferredPrefetches() // 首屏后的后台预热
```

## 面试指导

能把一个复杂初始化序列的"顺序约束"讲清楚，是高级工程师面试里的加分项。

关键是识别约束的来源：
1. **资源依赖**：A 的输出是 B 的输入（如代理配置 → API 预连接）
2. **状态依赖**：A 修改了 B 依赖的全局状态（如 `enableConfigs()` → `applySafeConfigEnvironmentVariables()`）
3. **安全约束**：A 不能在 B 完成之前执行（如 git 命令不能在 trust 之前执行）
4. **时机约束**：A 必须在某个外部事件之前完成（如 CA 证书在第一次 TLS 之前）

能把这四类约束系统性地应用到一个复杂初始化序列的分析上，展示的是真正的架构思维，而不只是背诵代码细节。
