---
title: "跨平台分析：Windows 为什么用 Registry 而不是文件目录来注册 Native Host？"
slug: "12-06-10-windowsmanifestregistry"
date: 2026-04-09
topics: [外延执行]
summary: "在 macOS 和 Linux 上，native host manifest 放在文件系统目录里，一个浏览器一个目录。在 Windows 上，manifest 放在一个公共位置，然后通过每个浏览器对应的 Registry key 指向它。这不是 Claude Code 的设计选择，而是 Windows 版 Chromium 浏览器协议的规定。"
importance: 1
---

# 跨平台分析：Windows 为什么用 Registry 而不是文件目录来注册 Native Host？

## 两种注册机制的根本差异

macOS 和 Linux 的 Native Messaging Host 注册方式：
- Chrome 在 `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/` 目录下查找 JSON manifest
- Brave 在自己的对应目录下查找
- 每个浏览器各有各的目录，互相独立

Windows 的 Native Messaging Host 注册方式：
- manifest JSON 文件放在任意位置
- 在 Registry 里注册一个 key，value 是 manifest 文件的路径
- Chrome 查 `HKCU\Software\Google\Chrome\NativeMessagingHosts\{name}`
- Brave 查 `HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\{name}`
- 每个浏览器各自查自己的 Registry 路径

这是 Chrome 官方文档规定的行为，不是 Claude Code 的设计选择。

## Claude Code 的 Windows 实现策略

`setup.ts` 里的 Windows 处理：

```ts
function getNativeMessagingHostsDirs(): string[] {
  const platform = getPlatform()

  if (platform === 'windows') {
    // Windows：用一个公共位置，通过 registry 分发
    const home = homedir()
    const appData = process.env.APPDATA || join(home, 'AppData', 'Local')
    return [join(appData, 'Claude Code', 'ChromeNativeHost')]
    // → C:\Users\{user}\AppData\Local\Claude Code\ChromeNativeHost\
  }
  // ...
}
```

只有一个目录（不是每个浏览器一个），然后 `registerWindowsNativeHosts()` 负责把这个位置告知各浏览器：

```ts
function registerWindowsNativeHosts(manifestPath: string): void {
  const registryKeys = getAllWindowsRegistryKeys()

  for (const { browser, key } of registryKeys) {
    const fullKey = `${key}\\${NATIVE_HOST_IDENTIFIER}`
    
    void execFileNoThrowWithCwd('reg', [
      'add',
      fullKey,
      '/ve',      // 设置默认（无名）值
      '/t', 'REG_SZ',
      '/d', manifestPath,  // 值是 manifest 文件路径
      '/f',       // 强制覆盖不提示
    ]).then(result => { /* 记录成功或失败 */ })
  }
}
```

## getAllWindowsRegistryKeys() 的内容

```ts
export function getAllWindowsRegistryKeys(): { browser: ChromiumBrowser; key: string }[] {
  const keys = []
  for (const browserId of BROWSER_DETECTION_ORDER) {
    const config = CHROMIUM_BROWSERS[browserId]
    if (config.windows.registryKey) {
      keys.push({ browser: browserId, key: config.windows.registryKey })
    }
  }
  return keys
}
```

返回的 Registry keys 包括：
- `HKCU\Software\Google\Chrome\NativeMessagingHosts`
- `HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts`
- `HKCU\Software\ArcBrowser\Arc\NativeMessagingHosts`
- `HKCU\Software\Chromium\NativeMessagingHosts`
- `HKCU\Software\Microsoft\Edge\NativeMessagingHosts`
- `HKCU\Software\Vivaldi\NativeMessagingHosts`
- `HKCU\Software\Opera Software\Opera Stable\NativeMessagingHosts`

每个浏览器的 Registry 路径在 CHROMIUM_BROWSERS 配置里预先定义好。

## HKCU 而不是 HKLM

注意所有 Registry keys 都在 `HKCU`（HKEY_CURRENT_USER），不是 `HKLM`（HKEY_LOCAL_MACHINE）。

区别：
- `HKCU`：当前用户的设置，不需要管理员权限修改
- `HKLM`：系统级设置，修改需要管理员权限

Claude Code 选择 `HKCU` 的原因很明显：不能要求用户运行管理员权限来安装浏览器桥。开发者的工作机通常不会以管理员身份运行日常程序。

用 `HKCU` 可以让 Claude Code 在普通用户权限下完成 Native Host 的注册，这对用户体验非常重要。

## reg.exe 命令的选择

```ts
void execFileNoThrowWithCwd('reg', [
  'add', fullKey,
  '/ve', '/t', 'REG_SZ',
  '/d', manifestPath,
  '/f',
])
```

这里直接调用了 Windows 内置的 `reg.exe` 命令行工具，而不是通过 Node.js 的 Registry API（如 `winreg` 包）。

原因：
- `reg.exe` 是 Windows 内置的，100% 可靠，不需要额外依赖
- Claude Code 本来就需要启动外部进程（`execFileNoThrow` 是公共工具），这种用法很自然
- 避免引入平台专用的 npm 依赖

## 面试考察点

这道题考察的是**对 Windows 系统编程约定的了解**，以及**跨平台代码的分支策略**。

Windows 和 Unix 在很多系统编程约定上不同：
- 进程间通信：Windows 偏向命名管道，Unix 偏向 Unix domain socket
- 应用配置：Windows 用 Registry，Unix 用配置文件目录
- 路径分隔符：`\` vs `/`
- 用户目录：`APPDATA`/`LOCALAPPDATA` vs `HOME`

处理这些差异的常见策略：
1. **条件分支**：`if (platform === 'windows') { ... }`，每种平台各自处理
2. **抽象层**：定义统一接口，各平台实现各自的细节（如 `getNativeMessagingHostsDirs()` 内部处理平台差异，对外返回相同类型）
3. **平台专用模块**：`setup.windows.ts`、`setup.unix.ts`，各自独立

Claude Code 混合使用了策略 1 和 2：大多数地方用策略 2（抽象函数），Windows 特有的 registry 操作用策略 1（明确的 `platform === 'windows'` 分支）。这是合理的权衡：可以抽象的地方抽象，太平台特定的操作就明确分支。

