---
title: "工程实践：wrapper script 固定落在 ~/.claude/chrome/ 说明了什么？"
slug: "12-06-11-wrapper-claude-chrome"
date: 2026-04-09
topics: [外延执行]
importance: 1
---

# 工程实践：wrapper script 固定落在 ~/.claude/chrome/ 说明了什么？

## 「长期设施」和「临时文件」的区别

软件系统里有两类文件：

**临时文件**：只在特定操作期间需要，操作完成后可以删除。放在 `/tmp` 或系统临时目录，随机命名，用完即弃。

**长期设施文件**：系统持续运行所依赖的配置、脚本、数据，需要稳定存在，有稳定路径。放在用户数据目录，路径固定，生命周期和应用相同。

Chrome Native Host 的 manifest 里有一行：

```json
{
  "path": "/Users/xxx/.claude/chrome/chrome-native-host"
}
```

Chrome 用这个路径来启动 Native Host。一旦 manifest 里的路径固定了，这个路径就是一个承诺：这个地址上永远会有一个可执行文件。

把 wrapper script 放到临时目录的后果：
- 临时目录的文件可能被 OS 清理
- 路径每次重新生成可能不同（如果包含 session ID 或随机字符串）
- 路径变化 = 需要重写 manifest = 需要触发 reconnect

`~/.claude/chrome/` 是用户数据目录，和 Claude Code 的其他配置文件（`~/.claude.json`、`~/.claude/` 目录下的各种文件）放在一起，生命周期和 Claude Code 相同。

## 固定命名而不是随机命名

```ts
const wrapperPath = platform === 'windows'
  ? join(chromeDir, 'chrome-native-host.bat')
  : join(chromeDir, 'chrome-native-host')
```

文件名是固定的 `chrome-native-host`（或 Windows 上的 `.bat`），不是随机的 UUID 或时间戳。

固定命名带来两个好处：

**一致性**：无论 Claude Code 重启多少次，wrapper script 的路径永远是 `~/.claude/chrome/chrome-native-host`。manifest 里的路径一次写好就不会变。

**可调试性**：用户或开发者可以直接检查这个文件：
```sh
cat ~/.claude/chrome/chrome-native-host
# 输出：
# #!/bin/sh
# exec "/usr/local/bin/claude" --chrome-native-host
```

如果是随机文件名，用户根本不知道去哪里找。

## 内容不变就不重写（再次出现）

`createWrapperScript()` 遵循和 `installChromeNativeHostManifest()` 相同的原则：

```ts
const existingContent = await readFile(wrapperPath, 'utf-8').catch(() => null)
if (existingContent === scriptContent) {
  return wrapperPath  // 内容相同，直接复用
}
```

这里的复用策略尤其重要：每次 `setupClaudeInChrome()` 被调用时（每次会话启动），都会触发 `createWrapperScript()`。如果每次都重写文件，`stat` 时间会更新，某些系统可能会把文件时间戳变化当作"文件改变"来处理。

更重要的是：对于 manifest 来说，wrapper script 路径是 manifest 内容的一部分。如果 wrapper script 路径没变但文件被重写，manifest 内容其实没变，但仍然触发了不必要的 manifest 写入检查。

## ~/.claude/chrome/ 目录的结构

在实际的用户机器上，这个目录的内容：

```
~/.claude/chrome/
  chrome-native-host          # Unix wrapper script（可执行）
  chrome-native-host.bat      # Windows wrapper script（如果在 Windows 上运行过）
```

结合 manifest 安装位置：

```
~/Library/Application Support/Google/Chrome/NativeMessagingHosts/
  com.anthropic.claude_code_browser_extension.json  # manifest
```

manifest 里的 `path` 字段指向 `~/.claude/chrome/chrome-native-host`。

这两个目录形成了 Native Host 接入链的完整基础设施：一个告诉浏览器"去哪里找 Native Host"，另一个是 Native Host 本身（通过 wrapper）。

## 升级时的幂等行为

Claude Code 升级到新版本后，如果二进制路径改变（比如从 `/usr/local/bin/claude` 变成 `/opt/homebrew/bin/claude`），wrapper script 的内容会改变：

旧内容：`exec "/usr/local/bin/claude" --chrome-native-host`
新内容：`exec "/opt/homebrew/bin/claude" --chrome-native-host`

这个差异会触发重写，然后 manifest 也需要更新（因为 manifest 里的 path 字段指向 wrapper，wrapper 内容变了但路径没变，所以 manifest 里的路径不变，但 manifest 内容里还有别的字段可能触发更新），最终触发 reconnect。

这是正确的行为：路径改变了，浏览器需要重新建立连接，使用新版本的 Native Host。

## 面试考察点

这道题考察的是**长期系统维护中的路径稳定性设计**。

一个关键问题：**你的系统里有哪些东西需要"稳定路径"？**

需要稳定路径的场景：
- 被其他系统引用的文件（如 manifest 里的 path）
- 配置文件（用户可能手动编辑，路径需要可预期）
- 符号链接的目标

不需要稳定路径的场景：
- 真正的临时文件（构建产物、缓存、日志）
- 只在程序运行期间存在的文件

识别哪些文件需要稳定路径，是系统设计里一个经常被忽视但很重要的判断。

