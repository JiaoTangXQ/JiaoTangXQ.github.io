---
title: "为什么创建 worktree 之后要调用 clearMemoryFileCaches() 和 updateHooksConfigSnapshot()？"
slug: "02-05-02-cwd-worktreesession"
date: 2026-04-09
topics: [工作台架构, 启动]
summary: >-
  面试追问：worktree 创建完成后，Claude Code 做了 clearMemoryFileCaches()、updateHooksConfigSnapshot() 等一系列"重置"操作。为什么这些缓存需要在 worktree 创建后失效？
importance: 1
---

# 为什么创建 worktree 之后要调用 clearMemoryFileCaches() 和 updateHooksConfigSnapshot()？

## worktree 创建后的重置序列

```typescript
// setup.ts（worktree 模式）
process.chdir(worktreeSession.worktreePath)
setCwd(worktreeSession.worktreePath)
setOriginalCwd(getCwd())
setProjectRoot(getCwd())
saveWorktreeState(worktreeSession)

// 关键：清除所有"旧目录"相关缓存
clearMemoryFileCaches()
resetSettingsCache()
// 重新在新目录下捕获 hooks 配置
updateHooksConfigSnapshot()
```

这个序列乍看冗余——不就是换了个目录吗？为什么要清缓存、重置配置、重新捕获 hooks？

## 答案：缓存里记录的是目录绑定的内容

`clearMemoryFileCaches()` 清理的是什么？

Claude Code 会缓存从文件系统读取的内容，以避免重复 I/O。这些缓存包括：
- CLAUDE.md 文件内容（`.claude/CLAUDE.md` 和 `CLAUDE.md`）
- 项目级 settings 读取结果
- 技能（Skills）文件列表

这些内容**都绑定到特定目录**。当 `cwd` 从原始目录切换到 worktree 目录后，这些缓存存储的是"错误目录"的数据。

如果不清除：
- 新 worktree 里的 `CLAUDE.md` 不会被读取（因为缓存里有旧目录的内容）
- worktree 的项目配置不会生效
- worktree 特有的技能定义不会被加载

## resetSettingsCache() 的角色

Settings 缓存同样是目录敏感的。

```typescript
// setup.ts 注释
// Settings cache was populated in init() (via applySafeConfigEnvironmentVariables)
// and again at captureHooksConfigSnapshot() above, both from the original dir's
// .claude/settings.json. Re-read from the worktree and re-capture hooks.
resetSettingsCache()
```

`init()` 时读取的是原始目录的 `.claude/settings.json`，这个结果被缓存了。worktree 目录下可能有不同的 `.claude/settings.json`（比如这个 worktree 是为了开发一个有特定配置的功能分支）。不重置缓存，新目录的配置就无法生效。

## updateHooksConfigSnapshot() vs captureHooksConfigSnapshot()

前面（setup 开始时）调用的是 `captureHooksConfigSnapshot()`（"初次捕获"），worktree 切换后调用的是 `updateHooksConfigSnapshot()`（"更新捕获"）。

两者做的事类似，但含义不同：
- 初次捕获：建立基准，用于后续比对
- 更新捕获：在目录变化后重建基准，以新目录的 hooks 为新基准

如果不更新：hook 比对会拿 worktree 的当前 hooks 和旧目录的基准对比，导致所有 hook 都被认为"发生了变化"（即使 worktree 里根本没有动过 hooks）。

## 缓存失效的普遍原则

这个模式体现了一个重要原则：**缓存的 key（缓存依据）发生变化时，必须主动使缓存失效**。

很多缓存 bug 来自于"key 变了，但代码没有感知到"。在 Claude Code 里，`cwd` 是所有文件读取缓存的隐式 key。当 `cwd` 变化时（通过 `process.chdir()` + `setCwd()`），所有依赖 `cwd` 的缓存必须失效。

`clearMemoryFileCaches()` 和 `resetSettingsCache()` 是这个失效操作的显式表达。

## 为什么不用更自动化的缓存失效机制？

理论上可以设计一个更优雅的方案：让 `setCwd()` 自动触发所有相关缓存的失效。这样就不需要手动调用 `clearMemoryFileCaches()` 等函数了。

但这需要在 `setCwd()` 里维护一个"所有 cwd 相关缓存"的注册表，每次添加新缓存都要记得注册。Claude Code 目前没有这个机制，选择了更显式的做法——在 cwd 变化的地方直接调用相关缓存的清理函数。

这是一个工程取舍：自动化机制更安全，但需要额外的框架；显式调用更简单，但要求维护者记住"cwd 变化时哪些缓存需要清理"。注释是这个约定的载体。

## 面试指导

"目录切换后的缓存处理"是全局状态管理里一个很具体的问题。

面试评估要点：
1. **意识到缓存的目录绑定性**：能识别出"这个缓存的 key 包含了目录信息"
2. **主动失效 vs 被动失效**：失效操作在哪里触发？由谁负责？
3. **失效的完整性**：是否所有相关缓存都被清理了？有没有遗漏（比如清了 CLAUDE.md 缓存但忘了 settings 缓存）？
4. **失效时机**：切换后立即失效，还是等到下次读取时再检测？

Claude Code 选择了"切换后立即失效"，保证了 worktree 切换后代码看到的状态是一致的新状态，而不是混合了旧目录和新目录数据的状态。
