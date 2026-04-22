---
title: "Buddy 的稀有度是怎么算出来的？userId 哈希背后的设计"
slug: "buddy-pet"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# Buddy 的稀有度是怎么算出来的？userId 哈希背后的设计

## 彩蛋设计：确定性随机的工程问题

Buddy 第一次孵化时，用户会得到一只属于他们的伴侣——特定的种类、眼睛样式、帽子和稀有度。这只伴侣是"随机"的，但如果重新安装 Claude Code，或者在另一台机器上登录，他们会得到**同一只**伴侣。

这是怎么做到的？答案在 `companion.ts` 里。

## Bones 和 Soul 的分离

`types.ts` 里有一个关键的设计决定，把伴侣的数据分成两类：

```typescript
// Bones：确定性部分，由 userId 哈希生成，永不持久化
export type CompanionBones = {
  rarity: Rarity
  species: Species
  eye: Eye
  hat: Hat
  shiny: boolean
  stats: Record<StatName, number>
}

// Soul：由模型生成，持久化到配置文件
export type CompanionSoul = {
  name: string
  personality: string
}
```

`Bones` 是每次从 `userId` 重新算出来的，不存档。`Soul` 是第一次孵化时模型生成的名字和性格，存在 `~/.claude.json` 里。

注释解释了这个设计的理由：**Bones 永不持久化，所以编辑 `config.companion` 没办法伪造一只 legendary 伴侣**——因为下次读取时 bones 会从 userId 重新计算，覆盖掉任何手动编辑。种类名称改变也不会破坏已存的伴侣，因为 `species` 字段是重新算的，而不是从配置里读的。

## 哈希 + 确定性 PRNG

```typescript
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

Mulberry32 是一个微型的有种子 PRNG（伪随机数生成器）。给定同样的种子，它总是产生同样的随机数序列。

`companion.ts` 把 `userId + SALT` 字符串哈希成一个数字，把这个数字作为 Mulberry32 的种子，然后用这个 PRNG 依次抽取：稀有度、种类、眼睛样式、帽子、是否闪光、五项属性数值。

同一个 userId，同样的 SALT，永远得到同样的伴侣。**跨设备、跨安装，伴侣保持一致。**

## 稀有度的加权抽取

稀有度不是等概率的：

```typescript
export const RARITY_WEIGHTS = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
}
```

`rollRarity()` 用加权抽样：把所有权重加起来得到 100，滚一个 0-100 的随机数，然后按权重区间判断落在哪个稀有度。Legendary 的概率是 1%，每 100 个用户里大约有一个。

这个概率不能通过重新安装来刷——因为稀有度由 userId 确定性决定，不是每次安装重新抽一次。

## 属性系统：峰值 + 转储

每只伴侣有五项属性：`DEBUGGING`、`PATIENCE`、`CHAOS`、`WISDOM`、`SNARK`。属性的生成规则是：

```typescript
// 一个峰值属性（最高）
// 一个转储属性（最低）
// 其余随机分布
// 稀有度提高全局下限（floor）
```

Legendary 伴侣的所有属性下限更高（`floor: 50`），而 common 的下限只有 5。这让稀有伴侣在属性面板上看起来明显更强，即使属性不影响任何游戏机制。

## 三路热路径的缓存

`companion.ts` 里有一个细节：

```typescript
// Called from three hot paths (500ms sprite tick, per-keystroke PromptInput,
// per-turn observer) with the same userId → cache the deterministic result.
let rollCache: { key: string; value: Roll } | undefined
export function roll(userId: string): Roll {
  const key = userId + SALT
  if (rollCache?.key === key) return rollCache.value
  const value = rollFrom(mulberry32(hashString(key)))
  rollCache = { key, value }
  return value
}
```

`roll()` 被三个高频路径调用：500ms 的 sprite tick、每次按键时的 PromptInput 渲染、每轮对话的 observer。每次调用都重新哈希会有性能问题，所以结果被缓存在模块级变量里。同样的 userId 只计算一次。

## /buddy pet 的状态设计

`AppStateStore` 里存的是 `companionPetAt?: number`——一个时间戳。不是 `petCount`，不是 `isPetting: boolean`，就是一个时间戳。

`CompanionSprite.tsx` 用这个时间戳和当前 tick 算出 `petAge`，再用 `PET_BURST_MS = 2500` 判断爱心动画是否还在播放：

```typescript
const petAge = petAt ? tick - petStartTick : Infinity;
const petting = petAge * TICK_MS < PET_BURST_MS;
```

这个设计的理由很直接：亲密反馈是一次性事件，不是常驻状态。只存时间戳，`AppStateStore` 不会因为每次 pet 多出新字段；动画效果靠时间差重建，不靠持久化状态。

2500 毫秒后，`petting` 变成 `false`，爱心自动消失。状态世界没有留下额外的痕迹。

## 面试指导

被问到"你会怎么设计一个游戏化的用户归属系统（比如每个用户有一个专属角色）"时，Bones/Soul 的分离给出了一个很好的参考方案：

把确定性的部分（外观、属性）和生成性的部分（名字、性格）分开。确定性部分从用户 ID 重新计算，不存档——这样防止作弊，也让种类扩展不破坏已有数据。生成性部分存档，因为它代表了这个用户和这只伴侣之间的关系，不应该重置。

这个设计模式在有收集元素的应用里很通用。
