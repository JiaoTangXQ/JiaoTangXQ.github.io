---
title: "VirtualMessageList 不是优化附件，而是长会话生命线"
slug: "11-09-01-virtualmessagelist"
date: 2026-04-09
topics: [终端界面]
summary: "VirtualMessageList.tsx 先交给 useVirtualScroll 算出窗口，再把搜索、跳转、sticky prompt 和选中项接到同一条阅读链路上。这样 transcript ..."
importance: 1
---

# VirtualMessageList 不是优化附件，而是长会话生命线

## 实现链
VirtualMessageList.tsx 先交给 useVirtualScroll 算出窗口，再把搜索、跳转、sticky prompt 和选中项接到同一条阅读链路上。这样 transcript 再长，屏上真正挂着的也只是当前窗口附近的消息。

## 普通做法
普通实现会继续全量挂载 transcript，或者在长了以后直接截断一段历史。那样写起来简单，但搜索、回跳和滚动很快就会开始互相打架。

## 为什么不用
这里不能靠先渲染出来再说，因为长会话里最贵的不是绘制，而是维持可回锚的上下文。只要还想让用户在未挂载区里继续搜索和跳转，列表就必须自己管理位置、缓存和校正。

## 代价
代价是状态更多，路径更长，很多看似局部的动作都要经过缓存和重算。换来的好处是 transcript 不是一次性浏览，而是可以持续工作到很长会话末尾。
