---
title: "面试题：「内容不变就不重写」——为什么这条原则在 manifest 安装里特别重要？"
slug: "12-06-04-manifest"
date: 2026-04-09
topics: [外延执行]
summary: "installChromeNativeHostManifest() 在写入 manifest 前会先读取现有内容，只有内容真的改变了才重写文件。createWrapperScript() 也遵循同样的原则。这不是微小的性能优化，而是避免「不必要的 manifest 改变触发不必要的浏览器侧扰动」的关键设计。"
importance: 1
---

# 面试题：「内容不变就不重写」——为什么这条原则在 manifest 安装里特别重要？

## 不必要的写入有什么代价？

在大多数文件操作场景里，"每次都重写"和"只有改变才写"的差别只是磁盘 IO 的些许浪费。但在 Chrome Native Host manifest 场景里，不必要的写入有一个特殊的代价：**它会触发 anyManifestUpdated = true，进而触发 reconnect 流程**。

看 `installChromeNativeHostManifest()` 的核心逻辑：

```ts
const manifestContent = jsonStringify(manifest, null, 2)
let anyManifestUpdated = false

for (const manifestDir of manifestDirs) {
  const manifestPath = join(manifestDir, NATIVE_HOST_MANIFEST_NAME)

  // 先读现有内容
  const existingContent = await readFile(manifestPath, 'utf-8').catch(() => null)
  
  // 只有内容真的变了才写入
  if (existingContent === manifestContent) {
    continue  // 内容相同，跳过
  }

  // 写入并标记
  await writeFile(manifestPath, manifestContent)
  anyManifestUpdated = true
}

// 只有真的更新了 manifest，才触发 reconnect
if (anyManifestUpdated) {
  void isChromeExtensionInstalled().then(isInstalled => {
    if (isInstalled) {
      void openInChrome(CHROME_EXTENSION_RECONNECT_URL)
    }
  })
}
```

如果每次启动都无条件重写 manifest，就会每次启动都打开 reconnect 页面，强制用户在浏览器里做一次重连操作。对于已经稳定运行的用户来说，这是无谓的干扰。

## 「只在必要时惊动系统」的设计哲学

这里体现的是一个更广泛的设计原则：**在接入外部系统时，尽量减少不必要的扰动**。

"扰动"的成本在不同系统里有很大差异：
- 写一个临时日志文件：几乎无代价
- 重启一个 HTTP 连接：有一定代价，但可接受
- 强制浏览器扩展重新建立 Native Host 连接：用户感知明显，需要用户操作

manifest 改写属于最后一类。每次不必要的改写都会产生用户可见的干扰（reconnect 页面弹出），这在每天多次启动 Claude Code 的开发者看来会非常烦人。

`createWrapperScript()` 遵循同样的原则：

```ts
async function createWrapperScript(command: string): Promise<string> {
  // ...
  // 先读现有内容
  const existingContent = await readFile(wrapperPath, 'utf-8').catch(() => null)
  
  // 内容相同则直接返回，不重写
  if (existingContent === scriptContent) {
    return wrapperPath
  }

  // 内容变了才写入
  await writeFile(wrapperPath, scriptContent)
  // ...
  return wrapperPath
}
```

manifest 和 wrapper script 都会被 Claude Code 在每次启动时调用安装逻辑（异步 fire-and-forget），所以这两个"只写必要"的检查在实践中非常频繁地被触发。

## 什么情况下 manifest 内容会改变？

manifest 内容是：

```json
{
  "name": "com.anthropic.claude_code_browser_extension",
  "description": "Claude Code Browser Extension Native Host",
  "path": "/path/to/wrapper/script",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://fcoeoabgfenejglbffodgkkbkcdhcgfn/",
    ...
  ]
}
```

manifest 内容会改变的情况：
1. Claude Code 安装路径变了（wrapper script 路径改变）
2. `allowed_origins` 改变（比如新增了开发版扩展 ID）
3. 用户更换了机器或重新安装了 Claude Code

这些都是真实有意义的变更，应该触发 reconnect。每次启动时 manifest 内容完全相同（大多数情况），不应该触发 reconnect。

## 内容比较的实现细节

注意比较方式：`existingContent === manifestContent`——这是字符串完全相等比较。

`manifestContent = jsonStringify(manifest, null, 2)` 使用了固定的格式化参数（缩进为 2 空格），确保每次生成的内容格式完全一致。如果用不同的序列化方式（比如一次 JSON.stringify 一次自定义格式化），同样的数据会生成不同的字符串，导致每次都判断为"内容变了"。

这里用了 `slowOperations.ts` 里的 `jsonStringify`（可能有确定性序列化的保证），而不是直接 `JSON.stringify`，也是为了确保格式的一致性。

## 幂等性设计

这种"只在必要时写入"的设计，让 `installChromeNativeHostManifest()` 和 `createWrapperScript()` 具备了幂等性：**无论调用多少次，效果和调用一次相同**。

幂等性在可以被重复调用的操作里非常重要。`setupClaudeInChrome()` 在每次会话启动时都会被调用，如果安装操作不是幂等的，每次启动都会产生副作用。

## 面试考察点

这道题考察的是**幂等性设计**和**理解副作用的波纹范围**。

"内容不变就不写"这个优化看起来很小，但它背后的思考是：**一个操作的副作用可能远超它直接影响的范围**（这里：写文件 → manifest 更新 → reconnect 触发 → 浏览器扩展重新握手 → 用户看到弹窗）。

设计接入外部系统的代码时，要问的不只是"这个操作做了什么"，还要问"这个操作会触发什么连锁反应"，然后只在这些连锁反应真的必要时才执行操作。

