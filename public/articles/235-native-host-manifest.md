---
title: "Native Host 和 manifest：浏览器接入链的产品级底座"
slug: "235-native-host-manifest"
date: 2026-04-09
topics: [浏览器扩展, 产品接入, Claude Code 内核]
importance: 0.9
---

# Native Host 和 manifest：浏览器接入链的产品级底座

面试题版本：**"Claude Code 的浏览器扩展需要用户安装 Native Host。为什么不能把这个步骤做成自动的？或者说，Claude Code 是如何尽量让这个步骤对用户透明的？"**

## 产品级接入 vs 技术文档级接入

**技术文档级接入**：
```
1. 下载 native-host 可执行文件，放到 /usr/local/bin/
2. 在 ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/ 创建 manifest.json 文件
3. 文件内容如下：[JSON 内容]
4. 在 Firefox 的对应目录也放一份
5. Windows 用户需要另外写注册表...
```

这是技术上正确的，但不是产品。

**产品级接入**：用户安装 Claude Code，运行后弹出"要启用浏览器集成吗？[是]"，点是，Claude Code 自动完成所有上述步骤。用户下次打开浏览器时，扩展已经可以用了。

## Claude Code 自动化接入的实现

在 `src/bridge/` 目录下，`bridgeEnabled.ts` 检查 bridge 是否已配置，`initReplBridge.ts` 处理 bridge 的初始化和安装。

当用户首次启用浏览器集成时，代码会：

**检测操作系统和浏览器**：
```typescript
// 根据平台选择正确的路径
const nativeHostDir = getPlatformNativeHostDir(browser, platform)
// macOS Chrome: ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/
// Linux Chrome: ~/.config/google-chrome/NativeMessagingHosts/
// Windows: 注册表路径
```

**生成 manifest 内容**：
```typescript
const manifest = {
  name: 'com.anthropic.claudecode',
  description: 'Claude Code Native Host',
  path: getClaudeCodeExecutablePath(),  // Claude Code 可执行文件路径
  type: 'stdio',
  allowed_origins: [getExtensionOrigin()],  // 只允许官方扩展
}
```

**写入 manifest 文件（或注册表条目）**：
这一步在 Windows 上需要写注册表，在 macOS/Linux 上需要创建目录和文件。代码处理了权限问题（如果目录不存在，先创建；如果没有写入权限，提示用户）。

## 多浏览器支持的复杂性

Chrome、Firefox、Edge 的 Native Messaging 配置路径不同：

```
Chrome (macOS): ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/
Firefox (macOS): ~/Library/Application Support/Mozilla/NativeMessagingHosts/
Edge (macOS):   ~/Library/Application Support/Microsoft Edge/NativeMessagingHosts/
```

每个浏览器需要独立的 manifest 文件（或注册表条目）。如果用户同时使用多个浏览器，需要在每个浏览器的对应位置都配置。

Claude Code 的实现会检测用户安装了哪些浏览器，在对应的位置创建配置，而不是只配置一个或要求用户手动选择。

## 为什么无法完全对用户透明

有些步骤无法完全自动化：

**权限限制**：在某些系统配置下（企业 IT 策略、受限用户账户），写入特定目录需要管理员权限。Claude Code 无法静默地获取这些权限，需要用户介入。

**扩展 ID 绑定**：manifest 里的 `allowed_origins` 需要包含扩展的 Chrome Extension ID。这个 ID 是稳定的（官方发布版本），但用户如果安装的是开发版本，ID 会不同，需要手动配置。

**防篡改检测**：某些安全软件会阻止写入浏览器的配置目录，Claude Code 无法绕过这些检查。

这些情况下，Claude Code 提供清晰的错误信息和指引，告知用户需要做什么，而不是默默失败。

## 面试角度的总结

Native Host 和 manifest 的自动安装是产品成熟度的标志：把"技术上必须做的步骤"转变为"用户感知不到的自动流程"。这需要处理多平台差异（macOS/Linux/Windows）、多浏览器差异（Chrome/Firefox/Edge）、权限问题、错误情况。Claude Code 在这里做的工程工作，对用户是透明的，但这个透明本身就是产品设计的目标。
