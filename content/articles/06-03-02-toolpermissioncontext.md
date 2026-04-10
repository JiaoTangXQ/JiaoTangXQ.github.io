---
title: “ToolPermissionContext 的权限快照会过期吗？刷新时机有多讲究？”
slug: "06-03-02-toolpermissioncontext"
date: 2026-04-09
topics: [治理与权限]
summary: “ToolPermissionContext 是快照不是实时查询。settings 文件变化后最多 1.5 秒才触发刷新，这个窗口期会造成什么问题？系统如何应对？”
importance: 1
---

# ToolPermissionContext 的权限快照会过期吗？刷新时机有多讲究？

权限快照的核心取舍：一致性 vs 时效性。系统选择了一致性，但为此需要精心设计刷新时机。

## 快照的生命周期

`ToolPermissionContext` 被存在 `AppState` 里，作为整个会话的全局权限状态：

```typescript
// AppState.ts 的简化结构
type AppState = {
  toolPermissionContext: ToolPermissionContext
  settings: Settings
  sessionHooks: SessionHooksState
  // ...
}
```

快照在以下时机被重建：
1. 会话初始化时（`permissionSetup.ts` 的初始化流程）
2. settings 文件被修改后，`applySettingsChange` 被调用时
3. 用户通过 `/settings` 命令修改权限时
4. 模式切换时（`transitionPermissionMode` 返回新的 context）

## 文件变化到快照刷新：最长 1.5 秒

`changeDetector.ts` 的文件监听使用了两个等待时间：

```typescript
const FILE_STABILITY_THRESHOLD_MS = 1000  // 文件写入稳定等待
const FILE_STABILITY_POLL_INTERVAL_MS = 500  // 轮询检测间隔
```

chokidar 的 `awaitWriteFinish` 配置：

```typescript
watcher = chokidar.watch(dirs, {
  awaitWriteFinish: {
    stabilityThreshold: FILE_STABILITY_THRESHOLD_MS,  // 1000ms
    pollInterval: FILE_STABILITY_POLL_INTERVAL_MS,    // 500ms
  },
})
```

这意味着：用户编辑 `~/.claude/settings.json` 并保存后，系统最多要等 1.5 秒（1000 + 500），等文件不再变化后，才触发 `handleChange` → `executeConfigChangeHooks` → `fanOut` → `settingsChanged.emit`。

## fanOut：缓存重置必须先于通知

```typescript
function fanOut(source: SettingSource): void {
  resetSettingsCache()       // 先重置缓存
  settingsChanged.emit(source)  // 再通知监听者
}
```

注释里有一段重要的历史背景：之前每个监听者都自己重置缓存，导致 N 个监听者会触发 N 次磁盘读取（”5 loadSettingsFromDisk calls in 12ms”）。现在统一在 fanOut 里重置，第一个监听者读磁盘时填充缓存，后续监听者直接命中缓存。

## applySettingsChange：快照的重建过程

```typescript
export function applySettingsChange(
  source: SettingSource,
  setAppState: (f: (prev: AppState) => AppState) => void,
): void {
  const newSettings = getInitialSettings()
  const updatedRules = loadAllPermissionRulesFromDisk()
  updateHooksConfigSnapshot()  // 同时更新 hooks 快照

  setAppState(prev => {
    let newContext = syncPermissionRulesFromDisk(prev.toolPermissionContext, updatedRules)

    // Ant-only：扫描并剥离过于宽松的 Bash allow 规则
    if (process.env.USER_TYPE === 'ant') {
      const overlyBroad = findOverlyBroadBashPermissions(updatedRules, [])
      if (overlyBroad.length > 0) {
        newContext = removeDangerousPermissions(newContext, overlyBroad)
      }
    }

    // 如果 bypassPermissions 被禁用了，更新 context
    if (newContext.isBypassPermissionsModeAvailable && isBypassPermissionsModeDisabled()) {
      newContext = createDisabledBypassPermissionsContext(newContext)
    }

    // plan/auto 模式的自动切换
    newContext = transitionPlanAutoMode(newContext)

    return { ...prev, settings: newSettings, toolPermissionContext: newContext }
  })
}
```

重建过程的顺序很关键：先从磁盘加载规则，再同步到 context，再应用模式级别的约束（bypassPermissions 禁用检查、plan/auto 模式转换），最后更新 AppState。

## 窗口期的实际风险

1.5 秒的窗口期在大多数场景下不是问题。但有一个特殊情况：**ConfigChange hook 可以阻止变化生效**。

```typescript
void executeConfigChangeHooks(
  settingSourceToConfigChangeSource(source),
  path,
).then(results => {
  if (hasBlockingResult(results)) {
    logForDebugging(`ConfigChange hook blocked change to ${path}`)
    return  // 不调用 fanOut，快照不更新
  }
  fanOut(source)
})
```

如果用户注册了 ConfigChange hook 并返回 exit code 2（block），settings 文件的变化会被**永久忽略**，快照不会更新。这是一个强有力的机制：管理员可以用 hook 来阻止特定的 settings 修改生效。

## 删除文件的特殊处理

settings 文件被删除时，有一个 “删除-重建” 的优雅处理：

```typescript
const DELETION_GRACE_MS =
  FILE_STABILITY_THRESHOLD_MS + FILE_STABILITY_POLL_INTERVAL_MS + 200  // 1700ms

function handleDelete(path: string): void {
  const timer = setTimeout(
    (p, src) => {
      pendingDeletions.delete(p)
      void executeConfigChangeHooks(...).then(results => {
        if (hasBlockingResult(results)) return
        fanOut(src)
      })
    },
    DELETION_GRACE_MS,  // 等待 1700ms
    path, source,
  )
  pendingDeletions.set(path, timer)
}
```

如果文件在 1700ms 内被重建（触发 `handleAdd`），删除计时器被取消，当作普通的 change 处理。这处理了”auto-updater 先删后写”这类常见模式，避免错误地触发”settings 被删除”通知。

## 这道题考什么

**快照时效性问题**是一道区分度很高的题目。浅层回答只说”用快照保证一致性”，深层回答需要说清楚：

1. 1.5 秒稳定窗口的设计意图（避免处理部分写入）
2. fanOut 的缓存重置必须在通知之前（防止 N 次磁盘读取）
3. ConfigChange hook 可以永久阻断快照更新（管理员的否决权）
4. 删除-重建的 grace period 处理（1700ms 的优雅处理）

能把这四点串起来讲的候选人，说明不只是读了接口声明，而是真正理解了设计背后的工程考量。
