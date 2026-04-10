---
title: "runMigrations() 里有 11 个迁移函数——为什么是这里执行，而不是别处？"
slug: "02-03-03-preaction"
date: 2026-04-09
topics: [工作台架构, 启动]
summary: "配置迁移（settings migration）是启动流程里最容易被忽视的一块。Claude Code 把它放在 preAction 钩子里，在特定位置执行——为什么不更早，也不更晚？"
importance: 1
---

# runMigrations() 里有 11 个迁移函数——为什么是这里执行，而不是别处？

## 迁移代码一览

```typescript
const CURRENT_MIGRATION_VERSION = 11;

function runMigrations(): void {
  if (getGlobalConfig().migrationVersion !== CURRENT_MIGRATION_VERSION) {
    migrateAutoUpdatesToSettings();
    migrateBypassPermissionsAcceptedToSettings();
    migrateEnableAllProjectMcpServersToSettings();
    resetProToOpusDefault();
    migrateSonnet1mToSonnet45();
    migrateLegacyOpusToCurrent();
    migrateSonnet45ToSonnet46();
    migrateOpusToOpus1m();
    migrateReplBridgeEnabledToRemoteControlAtStartup();
    if (feature('TRANSCRIPT_CLASSIFIER')) {
      resetAutoModeOptInForDefaultOffer();
    }
    saveGlobalConfig(prev =>
      prev.migrationVersion === CURRENT_MIGRATION_VERSION
        ? prev
        : { ...prev, migrationVersion: CURRENT_MIGRATION_VERSION }
    );
  }
  migrateChangelogFromConfig().catch(() => {});
}
```

这 11 个迁移函数覆盖了自动更新设置格式变更、权限模式迁移、一系列模型名称迁移（claude-sonnet-1m→sonnet-4-5→sonnet-4-6，claude-opus→opus-1m），以及功能标志迁移。

## 为什么放在 preAction 而不是更早？

**约束一：需要配置系统就绪**

所有迁移都要读写 `globalConfig`（`~/.claude/settings.json`）。`getGlobalConfig()` 依赖 `init()` 里的 `enableConfigs()` 已经执行。如果迁移在 `init()` 之前，`getGlobalConfig()` 返回的是未初始化的默认值。

**约束二：不能在 --help 路径上执行**

迁移会修改用户的配置文件。修改磁盘状态是副作用，应该只在用户真正执行某个功能时发生。`--help` 路径不应该修改任何文件。`preAction` 保证了这一点。

**约束三：必须在第一次读取全局配置之前完成**

很多后续代码会读取 `globalConfig`。如果这些代码读到的是"旧格式"的配置，可能行为不正确。迁移需要在任何业务逻辑消费配置之前完成。

## 为什么不在 init() 里执行？

这是一个工程权衡问题。

`init()` 搭建的是环境基础设施：网络、证书、代理、进程退出处理。这些东西是"系统能运行"的前提。

迁移是"用户数据在正确格式"的保证。这属于应用层逻辑，不是基础设施。

把迁移混进 `init()` 会模糊这个层次——`init()` 本来是"准备好能运行的世界"，而不是"整理用户数据"。

Claude Code 的注释里有一句很能说明这种分层意识：

```typescript
// @[MODEL LAUNCH]: Consider any migrations you may need for model strings.
// See migrateSonnet1mToSonnet45.ts for an example.
// Bump this when adding a new sync migration so existing users re-run the set.
const CURRENT_MIGRATION_VERSION = 11;
```

迁移版本号有独立的注释说明，有自己的命名约定，有维护建议。这说明迁移被视为一个独立的关注点，值得单独管理，而不是作为初始化链的一部分淡化。

## 版本号机制的工程细节

```typescript
saveGlobalConfig(prev =>
  prev.migrationVersion === CURRENT_MIGRATION_VERSION
    ? prev  // 已经是最新版本，不触发不必要的写盘
    : { ...prev, migrationVersion: CURRENT_MIGRATION_VERSION }
);
```

这里有一个小但重要的细节：只有当版本确实变化时才写磁盘。这是为了避免"每次启动都写一次配置文件"的性能问题，也避免了不必要的文件系统脏写（影响某些监控工具和备份系统）。

保存函数接受一个 updater 函数（而不是直接值），让它在内部做最终检查，这是一种防止并发写入冲突的常见模式。

## 异步迁移：fire-and-forget 的合理使用

```typescript
// Async migration - fire and forget since it's non-blocking
migrateChangelogFromConfig().catch(() => {
  // Silently ignore migration errors - will retry on next startup
});
```

`migrateChangelogFromConfig()` 是唯一一个异步执行、不阻塞主线程的迁移。

为什么？因为它处理的是 changelog 数据，不是影响当前会话行为的设置。即使失败，当前会话也能正常运行，下次启动会重试。

把这种"允许失败、会自动重试"的迁移从同步迁移链里分离出来，是很干净的错误隔离设计。

## 面试指导

配置迁移是 CLI 工具长期维护里最容易欠债的地方。面试里讨论这类问题时，几个关键设计决策：

1. **迁移的执行时机**：必须在配置系统就绪之后，又不能在轻量路径（`--help`）上执行
2. **迁移的幂等性**：迁移函数可以安全地重复执行，不会因为"已经迁移"而出错
3. **版本号机制**：用版本号控制哪些迁移需要运行，而不是每个迁移都检查"是否需要"
4. **失败处理**：可以重试的非关键迁移和必须成功的关键迁移要分开处理

Claude Code 的迁移系统在这四点上都有清晰的实现，是一个值得参考的案例。
