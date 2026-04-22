---
title: "串行写共享缓存：为什么不能直接 writeFile？并发自相踩踏的原理"
slug: "07-07-05-needs-auth"
date: 2026-04-09
topics: [扩展系统]
importance: 1
---

# 串行写共享缓存：为什么不能直接 writeFile？并发自相踩踏的原理

## 竞态条件的经典场景

假设两个 MCP 服务器 A 和 B 在几毫秒内先后认证失败。如果缓存写入不加控制：

```
时间线：
t=0ms: ServerA 读取 cache.json → {}
t=1ms: ServerB 读取 cache.json → {}
t=2ms: ServerA 写入 cache.json → { "serverA": {...} }
t=3ms: ServerB 写入 cache.json → { "serverB": {...} }
                                ↑ 覆盖了 serverA！
```

最终结果：`cache.json` 只有 serverB 的记录，serverA 的 `needs-auth` 状态丢失了。

下次启动时，系统不知道 serverA 需要认证，会再次尝试连接，再次失败，再次弹出提示。用户困惑：明明上次已经确认过了，为什么还在提示？

---

## 为什么 JavaScript 的 async/await 不够？

这是 Node.js 开发者容易犯的错误。JavaScript 是单线程的，`await` 会让出执行权，但这正是问题所在：

```typescript
// 错误的并发写法
async function markNeedsAuth(serverName: string) {
  const cache = JSON.parse(await readFile('cache.json'))  // ① 读取
  cache[serverName] = { timestamp: Date.now(), ttl: 900000 }  // ② 修改
  await writeFile('cache.json', JSON.stringify(cache))  // ③ 写入
}
```

如果两个 `markNeedsAuth` 调用并发运行：

```
markNeedsAuth('serverA'):  ① 读取（得到 {}）
markNeedsAuth('serverB'):  ① 读取（得到 {}，还是旧数据！）
markNeedsAuth('serverA'):  ② 修改（得到 { serverA: ... }）
markNeedsAuth('serverB'):  ② 修改（得到 { serverB: ... }，从 {} 开始！）
markNeedsAuth('serverA'):  ③ 写入（{ serverA: ... }）
markNeedsAuth('serverB'):  ③ 写入（{ serverB: ... }，覆盖！）
```

`await readFile` 让出执行权后，另一个调用可以插进来读取同一个文件。等第一个调用继续时，文件状态可能已经被另一个调用修改了——但第一个调用不知道。

---

## 串行化的实现：Promise 链

```typescript
// 正确的串行写法（简化示意）
let cacheWriteChain = Promise.resolve()

function markNeedsAuth(serverName: string) {
  cacheWriteChain = cacheWriteChain.then(async () => {
    const cache = JSON.parse(await readFile('cache.json'))
    cache[serverName] = { timestamp: Date.now(), ttl: 900000 }
    await writeFile('cache.json', JSON.stringify(cache))
  })
  return cacheWriteChain
}
```

通过把每个写入操作链接到前一个的 `.then()` 上，确保所有写入操作按顺序执行：

```
时间线：
markNeedsAuth('serverA') → cacheWriteChain = Promise → 读 → 写 → resolve
markNeedsAuth('serverB') → cacheWriteChain = oldChain.then(...) → 等 serverA 完成 → 读 → 写 → resolve
```

这样 serverB 的读取发生在 serverA 的写入完成之后，读到的是包含 serverA 的最新状态。

---

## 为什么不用文件锁（lockfile）？

`client.ts` 里也有 `lockfile` 的 import（用于 OAuth token 存储），但 needs-auth 缓存用的是 Promise 链而不是文件锁。

区别：

**文件锁（跨进程）：**
- 适合多个进程竞争同一个文件
- 锁释放前其他进程阻塞
- 有死锁风险（进程崩溃后锁未释放）

**Promise 链（进程内）：**
- 只解决进程内的并发问题
- 更轻量，没有文件系统操作
- 不能防止两个不同的 Claude Code 进程同时修改缓存

Claude Code 通常是单进程运行的，needs-auth 缓存的并发问题是进程内的多个 async 操作竞争，不是多进程竞争。Promise 链足够，不需要文件锁的开销。

---

## 极端情况：串行化带来的延迟

如果有 10 个 MCP 服务器同时失败，串行化意味着第 10 个服务器的 `needs-auth` 状态要等前 9 个都写完才能写入。

在实践中，这个延迟可以忽略：
- 每次写入只有几毫秒（本地文件 I/O）
- 10 个服务器同时失败的概率很低
- 即使有延迟，影响的也是"needs-auth 缓存"，不是工具调用本身

可以说，这里的串行化是"用少量延迟换取正确性"的正确权衡。

---

## 面试指导

**"JavaScript 是单线程的，为什么还会有并发问题？"**

这是 Node.js/浏览器面试的经典问题。标准答案是：单线程不等于无并发，异步操作（I/O、网络）在 await 期间会让出执行权，其他代码可以插进来。

**"如何解决 Node.js 中的 read-modify-write 竞态？"**

几种方法：

1. **Promise 队列/串行化**：把操作排成单列，每次只处理一个（本文描述的方案）
2. **乐观并发控制**：读取时记录版本号，写入时检查版本，版本不匹配则重试
3. **文件锁（lockfile）**：跨进程并发的解决方案
4. **数据库事务**：如果数据存在数据库里，利用事务的原子性

对于进程内、高频操作的场景，Promise 串行化是最简单且开销最小的选择。
