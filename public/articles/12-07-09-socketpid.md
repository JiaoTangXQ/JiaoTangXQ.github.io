---
title: "socket 地址的两层命名：用户级目录 + 进程级文件名"
slug: "12-07-09-socketpid"
date: 2026-04-09
topics: [外延执行]
summary: "getSocketDir() 把目录路径绑定到当前用户名，getSecureSocketPath() 再在目录下生成 pid.sock 文件名。先按用户隔离，再按进程区分，多用户多进程的场景下不会串话。"
importance: 1
---

# socket 地址的两层命名：用户级目录 + 进程级文件名

Claude Code 的浏览器桥用 Unix domain socket 进行本地连接。Socket 文件的命名不是随机的：

```
~/.local/share/claude-in-chrome/<username>/  ← 用户级目录
                                <pid>.sock    ← 进程级文件名
```

两层命名，两种粒度。

## 为什么需要两层

**用户级隔离**：同一台机器上可能有多个用户账号。A 用户的 Claude Code 不该连到 B 用户的浏览器扩展。按用户名建目录，每个用户的 socket 文件都在自己的目录里，物理上隔离。

**进程级区分**：同一个用户可能同时运行多个 Claude Code 进程（多个终端窗口，或者并行工作的多个实例）。每个进程都应该有自己的浏览器桥连接，不应该互相抢用同一个 socket。按 pid 命名文件，每个进程有唯一的 socket 路径。

## 扫描和发现

这个命名结构还支持发现功能：当需要找到「有哪些活跃的 Claude Code 进程可以连接」时，只需要：

1. 进入 `~/.local/share/claude-in-chrome/<username>/`
2. 列出所有 `.sock` 文件
3. 每个文件就是一个可连接的 Claude Code 进程

如果用完全随机的 socket 路径，就无法进行这种目录扫描式的发现。命名约定是服务发现的基础设施。

## Unix domain socket 的适用性

为什么用 socket 而不是 HTTP 或其他进程间通信？Unix domain socket 在本地通信里比 TCP socket 更高效（不走网络栈），文件系统权限可以控制谁能连接，路径即地址（不需要端口管理）。这是本地进程间通信的常见最优解。
