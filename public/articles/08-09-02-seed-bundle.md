---
title: "工程取舍：seed bundle 的三级降级策略是怎么设计的？"
slug: "08-09-02-seed-bundle"
date: 2026-04-09
topics: [远端与边界]
summary: "git bundle 有大小上限（默认 100MB），超出时依次尝试 --all → HEAD-only → squashed-root——三级降级是「能传多少上下文就传多少」的工程化实现，每一级都有明确的取舍说明。"
importance: 1
---

# 工程取舍：seed bundle 的三级降级策略是怎么设计的？

## 为什么需要 seed bundle？

Teleport 把本地会话迁移到远端 CCR 容器时，CCR 容器需要有和本地相同的代码库才能继续执行任务。

最朴素的方案：让 CCR 从 GitHub 克隆仓库。

但这有限制：
- 需要 GitHub 访问权限（用户可能用的是私有仓库或内部平台）
- 无法传递本地未提交的改动（WIP）
- 克隆速度慢（特别是大仓库）

seed bundle 是替代方案：把当前工作目录打包成 git bundle 格式，上传到 Anthropic Files API，CCR 容器从那里下载并恢复。

## git bundle 格式的优势

`git bundle` 是 git 原生支持的格式，把 git 对象（commits、trees、blobs）打包成一个可传输的文件，接收方可以用 `git bundle unbundle` 还原。

优势：
- 无需中间版本控制服务器
- 可以包含未推送的提交
- 可以通过 `refs/seed/stash` 包含 WIP 改动（通过 stash 转换为 ref 来让 bundle 包含它）

局限：
- 不能包含 untracked 文件（未被 git 追踪的文件）
- bundle 大小受限于 git 历史和所有分支的总大小

## 三级降级链

```
策略 1: git bundle --all
  → 包含所有分支、所有历史、refs/seed/stash（WIP）
  → 理想情况：完整快照
  → 如果 > 100MB，进入策略 2

策略 2: git bundle HEAD（当前分支只）
  → 包含当前分支的完整历史
  → 损失：其他分支、历史复杂度下降
  → 如果 > 100MB，进入策略 3

策略 3: squashed-root（单 commit 快照）
  → git commit-tree 创建一个无父节点的提交
  → 仅包含当前工作树的快照（没有历史）
  → 如果有 WIP：bake 进 commit（refs/seed/stash^{tree}）
  → 如果 > 100MB：失败，提示用户去 GitHub 配置
```

每一级降级的代价很清楚：

| 策略 | 包含 WIP | 历史深度 | 大小 |
|------|----------|----------|------|
| --all | 是（via stash） | 所有 | 最大 |
| HEAD | 是（via stash） | 当前分支 | 中等 |
| squashed | 是（baked in） | 无（单 commit） | 最小 |

## stash 的处理细节

WIP（Working In Progress，未提交的改动）处理是 bundle 逻辑里最精妙的部分：

```typescript
// 1. stash create：把 WIP 保存为 stash（不影响工作目录）
const stashResult = await execFile(git, ['stash', 'create'])
const stashSha = stashResult.stdout.trim()

// 2. 如果有 WIP，创建一个 ref 让 bundle 能引用它
if (stashSha) {
  await execFile(git, ['update-ref', 'refs/seed/stash', stashSha])
}

// 3. bundle --all 会自动包含 refs/seed/stash
const result = await mkBundle('--all')

// 4. 清理：删除临时创建的 ref，不污染用户的 repo
await execFile(git, ['update-ref', '-d', 'refs/seed/stash'])
```

`stash create` 只创建 stash 对象（返回一个 SHA），不修改工作目录，也不改变 HEAD。然后把这个 SHA 绑定到 `refs/seed/stash` 这个 ref 上，让 bundle 的 `--all` 能把它包含进去。

bundle 上传完后，立刻删除 `refs/seed/stash`——这是一个临时 ref，用完就删，不留痕迹。

为什么不用普通的 `git stash`（会污染 stash 列表）？`stash create` 只返回 SHA，不修改 refs，是"只读"的，更干净。

## squashed-root 的极限方案

当 HEAD bundle 还是太大时，最后的手段是 squashed commit：

```typescript
// commit-tree 创建一个新的提交，内容是当前 HEAD 的目录树（没有父节点）
const squashedSha = await execFile(git, ['commit-tree', 'HEAD^{tree}', '-m', 'seed'])

// 如果有 WIP，用 WIP 的目录树（而不是 HEAD 的）
const treeRef = hasStash ? 'refs/seed/stash^{tree}' : 'HEAD^{tree}'
```

注意 `refs/seed/stash^{tree}`：这是获取 stash commit 对应的目录树，而不是 stash commit 本身（stash commit 有父节点，包含父节点会把历史拖回来）。squashed 方案的目标是"只要文件内容，不要历史"。

这个 squashed commit 被保存到 `refs/seed/root`，bundle 只包含这一个 ref。大小只取决于文件总量，不受历史深度影响。

## 代价和局限

**不能包含 untracked 文件**：`git bundle` 只包含 git 追踪的内容，新创建但还没 `git add` 的文件无法传输。

注释里直接写了：

```typescript
// untracked not captured.
```

这是一个已知限制，没有被掩盖，而是诚实地告知用户。

**squashed-root 的限制**：接收方（CCR）需要能处理一个没有父节点的 commit，不能直接 `git checkout` 到正常分支——需要特殊的 unbundle 处理。注释里：

```typescript
// Receiver needs refs/seed/root handling for that tier.
```

## 面试指导

"如何在带宽/大小限制下传输代码库"是 DevOps/基础设施面试里的好题目。

设计要点：

1. **识别"必须传"和"尽力传"的内容**：提交历史（可以降级丢失）vs 当前工作树（必须传）
2. **三级降级**：每一级都有明确的损失，损失是已知的，不是意外的
3. **临时 ref 的清理**：操作期间创建的临时 git ref 必须在完成后删除，不污染用户的 repo
4. **失败的分级**：`git_error`（环境问题）、`too_large`（可预期的限制）、`empty_repo`（特殊情况），各给不同的提示

"三级降级 + 明确说明每级损失"是这个设计最值得借鉴的模式。它比"失败就报错"或"无限尝试"都更实用——用户能根据降级结果知道哪些上下文没有被传到远端，可以手动补充。
