---
title: "面试题：为什么只缓存正向检测而不缓存负向结果？一道关于「不对称错误代价」的设计题"
slug: "12-06-12-stale-truefalse"
date: 2026-04-09
topics: [外延执行]
importance: 1
---

# 面试题：为什么只缓存正向检测而不缓存负向结果？一道关于「不对称错误代价」的设计题

## 缓存设计的常见思路

大多数缓存系统把正负结果一视同仁：检测的结果是什么，就缓存什么。下次同样的检测就直接用缓存值，不再做实际检测。

Claude Code 的扩展安装检测做了一个不寻常的选择：**只缓存"已安装"这个正向结果，从不缓存"未安装"这个负向结果**。

代码注释写得非常清楚：

```ts
/**
 * Only positive detections are persisted. A negative result from the
 * filesystem scan is not cached, because it may come from a machine that
 * shares ~/.claude.json but has no local Chrome (e.g. a remote dev
 * environment using the bridge), and caching it would permanently poison
 * auto-enable for every session on every machine that reads that config.
 */
function isChromeExtensionInstalled_CACHED_MAY_BE_STALE(): boolean {
  void isChromeExtensionInstalled().then(isInstalled => {
    if (!isInstalled) { return }  // 负向结果：不缓存，直接 return
    
    // 只有正向结果才写入缓存
    const config = getGlobalConfig()
    if (config.cachedChromeExtensionInstalled !== isInstalled) {
      saveGlobalConfig(prev => ({ ...prev, cachedChromeExtensionInstalled: isInstalled }))
    }
  })

  const cached = getGlobalConfig().cachedChromeExtensionInstalled
  return cached ?? false
}
```

## 不对称代价的分析

假设两种错误情况：

**Stale `false`（错误地缓存了"未安装"）**：

用户在机器 A 上第一次运行时，扩展确实没安装，系统检测到 `false`。如果把这个 `false` 缓存到 `~/.claude.json` 里，然后 `~/.claude.json` 通过 dotfiles sync 同步到机器 B。机器 B 上有 Chrome 扩展，但读到缓存的 `false`，`shouldAutoEnableClaudeInChrome()` 永远返回 `false`。

修复方法：用户需要知道有这个缓存机制，找到 `~/.claude.json`，手动删除 `cachedChromeExtensionInstalled` 字段，或者手动设置为 `true`。对大多数用户来说，这几乎不可能自己解决。

**Stale `true`（错误地缓存了"已安装"）**：

用户在机器 A 上安装了扩展，缓存了 `true`，然后卸载了扩展，或者把 `~/.claude.json` 同步到了没有扩展的机器 B。`shouldAutoEnableClaudeInChrome()` 返回 `true`，Claude Code 尝试建立 Chrome 连接，失败，报一个错误（或静默失败）。

失败的代价：一次无声的连接尝试，也许有一条日志。然后用户手动使用 `--no-chrome` 或不用浏览器功能，生活继续。

## 决策框架：错误类型 × 恢复难度

| | Stale True | Stale False |
|---|---|---|
| 实际影响 | 一次无声连接尝试 | 永久毒死自动启用 |
| 用户感知 | 几乎没有 | 功能神秘地不工作 |
| 自动恢复 | 下次真实检测到扩展后修正 | 不会自动恢复 |
| 手动修复 | 不需要 | 需要找到并编辑 JSON 文件 |

显然 stale `false` 的代价远高于 stale `true`。不对称缓存策略选择接受代价低的错误（stale true），避免代价高的错误（stale false）。

## 配置文件共享场景是关键假设

这个设计的关键前提是：`~/.claude.json` 可能被共享到多台机器。

在现代开发环境里，这种共享非常常见：
- Dotfiles 通过 Git 同步到多台机器
- 远端开发（SSH、GitHub Codespaces）使用本地配置
- 公司统一配置通过 MDM 推送
- 云存储同步整个 home 目录

如果 `~/.claude.json` 只属于单台机器（像 macOS 的 Keychain），缓存负向结果也许是合理的。但它的设计是跨机器共享的，所以必须考虑"一台机器上的缓存结果在另一台机器上是否仍然有效"。

正向结果在跨机器场景里可能是错的（这台机器没装扩展），但代价可接受。负向结果在跨机器场景里也可能是错的，但代价是永久性的，不可接受。

## 后台刷新机制

```ts
void isChromeExtensionInstalled().then(isInstalled => {
  if (!isInstalled) { return }
  // 更新缓存...
})
```

注意这是 `void`（fire-and-forget）：后台运行真实检测，完成后如果结果是正向，才更新缓存。

这意味着：
1. 函数立即返回缓存值（同步）
2. 真实文件系统扫描在后台进行（异步）
3. 如果这次扫描发现"已安装"，缓存得到更新，下次启动就能直接用

第一次安装扩展后：
- 启动 Claude Code → 缓存无 → 后台扫描 → 发现已安装 → 写缓存
- 下次启动 → 缓存有 → 直接返回 true → 自动启用

这个流程稍微有点延迟（第一次安装后，需要等到下次启动才会自动启用），但是完全可接受的。

## 面试考察点

这道题是一道标准的**系统设计权衡题**：**在有多种错误情况时，如何根据各种错误的代价来设计策略**。

不是所有错误代价都相等。好的工程师会分析每种错误情况的：
1. 发生概率
2. 影响范围
3. 检测难度（用户能否发现问题？）
4. 恢复难度（问题出现后怎么修复？）

然后选择最小化"总期望危害"的策略，而不是最小化"错误发生次数"的策略。

Claude Code 的扩展检测缓存策略，是这种思维方式的一个很好的教学案例。

