---
title: "Native Host、manifest 和注册表：浏览器扩展接入链的底座为什么这么重"
slug: "195-native-host-manifest"
date: 2026-04-09
topics: [浏览器扩展, 产品接入, Claude Code 内核]
importance: 0.9
---

# Native Host、manifest 和注册表：浏览器扩展接入链的底座为什么这么重

面试题版本：**"Claude Code 要接入浏览器需要安装 Native Host 程序、写 manifest 文件、在特定目录或 Windows 注册表里注册。这个流程为什么不能简化？每一步解决的是什么问题？"**

## 浏览器扩展的安全沙箱

Chrome、Firefox 等浏览器把扩展运行在严格的沙箱里，扩展代码不能直接访问本地文件系统、不能运行任意程序、不能直接建立 TCP 连接。这不是设计缺陷，而是对用户的保护：恶意网站不能通过扩展 API 攻击用户的本地系统。

但这个安全模型给 Claude Code 带来了挑战：Claude Code 的核心能力（文件操作、执行命令、访问 MCP server）都在本地，而浏览器扩展在沙箱里。

## Native Messaging 协议

浏览器提供了一个正式的"跨越沙箱"机制：Native Messaging。工作原理：

1. 本地有一个 Native Host 程序（Claude Code 的可执行文件或一个专用的 bridge 程序）
2. 浏览器扩展向浏览器请求和这个 Native Host 通信
3. 浏览器启动 Native Host 程序，把扩展的消息通过 stdin/stdout 传递
4. Native Host 可以访问所有本地资源，把结果通过 stdout 返回给扩展

这个机制之所以安全：**浏览器作为可信中间人，控制了哪些 Native Host 可以被哪些扩展访问**。

## manifest 文件的角色

要让浏览器知道"有一个叫 Claude Code 的 Native Host 可以被使用"，需要在特定位置放一个 manifest JSON 文件：

```json
{
  "name": "com.anthropic.claudecode",
  "description": "Claude Code Native Host",
  "path": "/usr/local/bin/claude-native-host",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://[extension-id]/"]
}
```

**`name`**：Native Host 的唯一标识，浏览器用这个名字找 manifest。
**`path`**：Native Host 程序的路径，浏览器用这个路径启动程序。
**`allowed_origins`**：只有列出的扩展 ID 才能连接这个 Host，其他扩展无法访问。

这个文件不在任意位置，必须在操作系统规定的特定路径：
- macOS：`~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`
- Linux：`~/.config/google-chrome/NativeMessagingHosts/`
- Windows：注册表 `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.anthropic.claudecode`

## 为什么不能简化

**能不能把 manifest 放在别处？** 不能。浏览器出于安全考虑，只在固定路径里查找 manifest，这个路径是操作系统用户级目录（不需要管理员权限）或系统级目录（需要管理员权限）。自定义路径意味着绕过了操作系统的权限控制。

**能不能不写注册表（Windows）？** Windows 上浏览器用注册表而不是文件系统路径来注册 Native Host，这是 Windows 的设计。不写注册表，浏览器就找不到 Native Host，连接请求会失败。

**能不能省略 `allowed_origins`？** 不能省略（会被拒绝），也不应该设置为通配符（安全漏洞）。精确的 allowed_origins 确保只有 Claude Code 官方扩展才能连接 Native Host，其他恶意扩展无法冒充。

## 在源码里的体现

`src/bridge/` 目录下的代码负责管理这个接入链。`bridgeConfig.ts` 处理 bridge 的配置，`bridgeEnabled.ts` 检查 bridge 是否可用，`initReplBridge.ts` 初始化 REPL 侧的 bridge 连接。

Claude Code 在安装或首次运行时自动完成这些注册步骤（写 manifest 文件、Windows 注册表条目等），而不是要求用户手动操作。这是"产品级接入"和"技术文档级接入"的区别：用户不应该需要知道 Native Messaging 的工作原理，才能使用浏览器集成功能。

## 面试角度的总结

Native Host + manifest + 注册表这套底座看起来复杂，是因为它在遵守操作系统和浏览器施加的安全约束。这些约束不是 Claude Code 的设计选择，而是在浏览器安全沙箱里工作的必要代价。产品接入链的工程判断是：把这个必要代价在安装时一次性完成，让用户在使用时感知不到这套底座的存在。
