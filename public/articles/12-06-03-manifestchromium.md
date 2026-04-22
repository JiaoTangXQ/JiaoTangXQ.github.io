---
title: "跨平台分析：Chromium 生态为什么是碎的，以及接入它需要承受什么？"
slug: "12-06-03-manifestchromium"
date: 2026-04-09
topics: [外延执行]
importance: 1
---

# 跨平台分析：Chromium 生态为什么是碎的，以及接入它需要承受什么？

## Chromium 生态的碎片化程度

`common.ts` 里的 `CHROMIUM_BROWSERS` 对象定义了 7 种浏览器：

```ts
export const CHROMIUM_BROWSERS: Record<ChromiumBrowser, BrowserConfig> = {
  chrome: { ... },
  brave: { ... },
  arc: { ... },
  chromium: { ... },
  edge: { ... },
  vivaldi: { ... },
  opera: { ... },
}
```

每种浏览器在 macOS、Linux、Windows 上有不同的：
- 应用名（macOS `open -a` 用的）
- 数据目录路径
- NativeMessagingHosts 目录路径
- 二进制文件名（Linux）
- Registry key（Windows）

以 Opera 为例，它和其他浏览器有一个独特的差异：

```ts
opera: {
  windows: {
    dataPath: ['Opera Software', 'Opera Stable'],
    registryKey: 'HKCU\\Software\\Opera Software\\Opera Stable\\NativeMessagingHosts',
    useRoaming: true,  // Opera uses Roaming AppData, not Local
  },
}
```

Opera 在 Windows 上使用 `Roaming AppData`，而其他浏览器都用 `Local AppData`。这个差异如果没处理到，Opera 用户就会遇到"明明装了扩展但检测失败"的问题。

## 为什么有这么多浏览器

从开发者视角：
- macOS 用户：Chrome + Arc（开发者常用）
- Windows 用户：Chrome + Edge（系统默认）+ Brave（隐私意识强的开发者）
- Linux 用户：Chrome + Chromium（开源版）

Claude Code 面向开发者，开发者的浏览器选择比普通用户更多样。如果只支持 Chrome，会排除掉相当比例的目标用户群。

## 浏览器检测的优先级设计

```ts
export const BROWSER_DETECTION_ORDER: ChromiumBrowser[] = [
  'chrome',   // 最常见
  'brave',    // 隐私意识强的开发者常用
  'arc',      // macOS 上的新星
  'edge',     // Windows 默认
  'chromium', // 开源版本
  'vivaldi',  // 小众但忠实
  'opera',    // 最小众
]
```

这个顺序不是随意的。`detectAvailableBrowser()` 按这个顺序扫描，返回第一个找到的浏览器。把最常见的放在前面，可以在大多数用户机器上快速找到浏览器，不用扫描所有可能。

## 错误容忍的安装策略

`installChromeNativeHostManifest()` 里的多目录写入使用了"失败继续"策略：

```ts
for (const manifestDir of manifestDirs) {
  try {
    await mkdir(manifestDir, { recursive: true })
    await writeFile(manifestPath, manifestContent)
    anyManifestUpdated = true
  } catch (error) {
    // 记录但不失败 — 浏览器可能没装
    logForDebugging(`Failed to install manifest at ${manifestPath}: ${error}`)
  }
}
```

这个策略背后的判断：**某个浏览器的 manifest 目录不存在，不是错误，而是正常情况（用户没装那个浏览器）**。

严格失败策略（任何一个目录写失败就整体失败）会导致：用户没装 Arc，Arc 的目录创建失败，整个 manifest 安装失败，Chrome 也没装上。这显然是过于严格。

"失败继续"策略（每个目录独立处理，失败只记录日志）才能正确处理"用户只装了部分浏览器"这种正常情况。

## getAllNativeMessagingHostsDirs() 与 getNativeMessagingHostsDirs() 的区别

`setup.ts` 里有两个相关函数：

**`common.ts` 里的 `getAllNativeMessagingHostsDirs()`**：返回所有支持的浏览器的 NativeMessagingHosts 目录，不管它们是否存在。

**`setup.ts` 里的 `getNativeMessagingHostsDirs()`**：在此基础上，对 Windows 做特殊处理——Windows 用一个公共目录，不给每个浏览器单独目录：

```ts
function getNativeMessagingHostsDirs(): string[] {
  const platform = getPlatform()

  if (platform === 'windows') {
    // Windows 用单一落点 + registry 分发
    const home = homedir()
    const appData = process.env.APPDATA || join(home, 'AppData', 'Local')
    return [join(appData, 'Claude Code', 'ChromeNativeHost')]
  }

  // macOS 和 Linux：每个浏览器各自的目录
  return getAllNativeMessagingHostsDirs().map(({ path }) => path)
}
```

这个分层设计很清晰：`common.ts` 提供原始的浏览器路径信息，`setup.ts` 根据平台特性决定实际的安装策略。

## Arc 在 Linux 上不可用

```ts
arc: {
  linux: {
    binaries: [],    // Arc 没有 Linux 版本
    dataPath: [],
    nativeMessagingPath: [],
  },
}
```

Arc 是 macOS 独占浏览器（也有 Windows 版本，但没有 Linux 版）。代码里用空数组表示"这个浏览器在这个平台上不存在"，而不是条件判断。

这样处理的好处：`getAllNativeMessagingHostsDirs()` 里的过滤逻辑是统一的：

```ts
if (config.linux.nativeMessagingPath.length > 0) {
  paths.push(...)
}
```

空数组直接通不过这个检查，不需要额外的平台判断。

## 面试考察点

这道题考察的是**如何应对真实世界的碎片化**，以及**错误容忍设计的应用场景**。

在设计跨平台功能时，有一个常见的认知偏差：工程师倾向于按"应该是这样的"来设计，而不是按"实际上是这样的"来设计。

Chromium 生态"应该是"：Chrome 是标准，其他浏览器遵循相同的约定，路径和格式统一。

Chromium 生态"实际上是"：7 种主流浏览器，每种有不同的目录结构，Opera 特立独行用 Roaming AppData，Arc 只有 macOS，Arc 在 Windows 上有 registry key 但格式和其他不同。

接受"实际上是这样"，而不是希望"应该是那样"，是处理真实世界碎片化问题的第一步。后面的工程工作（把每种情况都处理到）才有意义。

