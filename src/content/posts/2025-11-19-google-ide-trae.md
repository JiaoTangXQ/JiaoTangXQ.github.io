---
title: "看完了 Google 这个新 IDE 的演示，我手里的 Trae 突然就不香了"
description: "深度解析 Google Antigravity，一款基于 Gemini 3.0 的全新 AI IDE。了解它的三大核心界面、全自动编程模式和项目报告功能。本文将解释它为何不只是代码助手，而是一个能接管完整开发任务的系统。"
date: "2025-11-19T15:32:00.000Z"
tags:
  - "Google Antigravity 是什么"
  - "AI 编程"
  - "Gemini 3.0 编程"
  - "Google 新编程工具"
  - "AI 开发环境"
pillar: "notes"
tier: "B"
related: []
draft: false
lang: "zh"
---

<div class="cyber-prose max-w-none"><p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">行吧，又攒了几个想聊的东西，本来想以后再说，但看完 Google 这个新出的演示视频，实在忍不住了，赶紧写下来免得忘了。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">是这样的，前两天 DeepMind 居然悄咪咪搞了个大动静，发布了一个叫 <strong class="font-semibold text-[var(--color-text-primary)]">Google Antigravity</strong> 的东西。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">乍一看是个 IDE（集成开发环境），但我越看越觉得不对劲。这玩意儿跟咱们现在用的 Cursor 或者 Copilot 好像不太一样。它给我的感觉，不像是给我手里塞了一把更快的“枪”，而是直接给我配了个能扛事的“观察手”。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">我就顺着我的看片思路，跟大伙唠唠这东西到底有点啥意思。</p>
<h2 class="text-xl font-semibold mt-10 mb-5 text-[var(--color-text-primary)] pb-2 tracking-tight group" id="-这界面有点反直觉但我想试试"><span class="bg-gradient-to-r pr-4 rounded-l-lg -ml-2 pl-2 py-1">🤨 这界面有点“反直觉”，但我想试试</span></h2>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">刚打开视频的时候，我其实是有点懵的。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">一般来说 IDE 不就是左边文件树，右边代码框么？Antigravity 居然整出了三个核心界面，它叫“Three Surfaces”。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">除了咱们熟悉的 <strong class="font-semibold text-[var(--color-text-primary)]">Editor</strong>（编辑器），它还硬塞进来一个 <strong class="font-semibold text-[var(--color-text-primary)]">Agent Manager</strong>（代理管理器）和一个 <strong class="font-semibold text-[var(--color-text-primary)]">Browser</strong>（浏览器）。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">&gt; 居然直接把 Chrome 塞进 IDE 里了？这内存占用真的不会原地爆炸吗……不过转念一想，Chrome 本来就是 Google 自家的，深度集成一下好像也没毛病。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">这个 <strong class="font-semibold text-[var(--color-text-primary)]">Agent Manager</strong> 挺有意思，你可以在这看到好几个 AI 代理在干活。对，不是一个，是一堆。你可以指挥这个去写后端，那个去画图。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">而那个内置的 <strong class="font-semibold text-[var(--color-text-primary)]">Browser</strong>，绝不仅仅是给你预览网页用的。最骚的操作来了：<strong class="font-semibold text-[var(--color-text-primary)]">它是给 AI 用的。</strong></p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">AI 写的代码跑起来之后，AI 自己会控制这个浏览器，像个真人测试员一样，去点击按钮、输入文字、滚动页面。这画面真的，看着 AI 在那儿自己点自己写的网页，竟然有一种“孩子长大了会自己穿衣服”的欣慰感。</p>
<h2 class="text-xl font-semibold mt-10 mb-5 text-[var(--color-text-primary)] pb-2 tracking-tight group" id="-别问问就是全自动"><span class="bg-gradient-to-r pr-4 rounded-l-lg -ml-2 pl-2 py-1">🤖 别问，问就是“全自动”</span></h2>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">现在的 AI 编程工具，大多还是得你一句我一句地聊：“帮我写个函数”、“帮我改个 bug”。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">Antigravity 居然搞了个 <strong class="font-semibold text-[var(--color-text-primary)]">Auto 模式</strong>。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">开了这个模式，AI 就放飞自我了。它觉得需要安装依赖，就自己去跑终端命令；觉得需要建个文件，就自己建了。它不会每一步都停下来问你：“哎，大哥，我能跑个 npm install 吗？”</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">当然，视频里也说了，敏感操作它还是会来请示你的。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">&gt; 我现在的状态就是，有时候连 prompt 都懒得敲。这种“我就看着不动手”的感觉，确实有点爽。只要别给我把库删了就行。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">而且它支持<strong class="font-semibold text-[var(--color-text-primary)]">多任务并行</strong>。演示里那个老哥，一边让 AI 写后端 API，一边顺手开了个新对话让它设计 Logo。这俩事儿是同时进行的，互不耽误。这才是多核 CPU 该干的事儿嘛。</p>
<h2 class="text-xl font-semibold mt-10 mb-5 text-[var(--color-text-primary)] pb-2 tracking-tight group" id="-拒绝黑盒它居然会写报告"><span class="bg-gradient-to-r pr-4 rounded-l-lg -ml-2 pl-2 py-1">📝 拒绝“黑盒”，它居然会写报告</span></h2>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">大伙用 AI 写代码最怕啥？最怕它写了一堆不知所云的东西，跑不通还很难 debug。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">Antigravity 这里引入了一套叫 <strong class="font-semibold text-[var(--color-text-primary)]">Artifacts</strong> 的东西，我觉得这个思路特别对。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">它在干活之前，会先给你列个 <strong class="font-semibold text-[var(--color-text-primary)]">Task List</strong>（任务清单），告诉你它打算分几步走。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">然后，注意了，它会出个 <strong class="font-semibold text-[var(--color-text-primary)]">Implementation Plan</strong>（实施计划）。这就像是它先给你交个技术方案文档，你点头了它再动手。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">最绝的是干完活之后，它会生成一份 <strong class="font-semibold text-[var(--color-text-primary)]">Walkthrough</strong>（演练报告）。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">&gt; 以前我都是被 Leader 催着写日报，现在好了，AI 给我写日报。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">这个报告里不仅有它改了啥代码，甚至还有录屏！就是刚才提到的那个内置浏览器，它会把自己测试的过程录下来给你看：“你看，我输入了航班号，点击了搜索，结果出来了，没毛病。”</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">这就很让人放心了。</p>
<h2 class="text-xl font-semibold mt-10 mb-5 text-[var(--color-text-primary)] pb-2 tracking-tight group" id="-配合-gemini-30脑子确实好使"><span class="bg-gradient-to-r pr-4 rounded-l-lg -ml-2 pl-2 py-1">🧠 配合 Gemini 3.0，脑子确实好使</span></h2>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">这背后跑的模型，是 Google 最新的 <strong class="font-semibold text-[var(--color-text-primary)]">Gemini 3.0</strong>。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">视频里那个“航班追踪器”的 Demo 确实秀肌肉。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">AI 为了搞定数据，居然自己去搜了 &quot;Aviation Stack API&quot; 的文档。它不是瞎编一个 URL，而是真真切切地去读了文档，甚至还在终端里跑了个 <code class="px-1.5 py-0.5 text-[var(--cp-yellow)] bg-[var(--cp-yellow)]/10 font-mono text-[0.85em]">curl</code> 命令去验证 API Key 对不对，返回的数据结构长啥样。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">甚至连 Logo 都是它现场用 Nano Banana 模型生成的，顺手就给塞到项目里去了。最后还把航班信息集成到了 Google Calendar 里。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">这哪是代码补全啊，这完全是一个这就具备初级全栈工程师+测试工程师+UI设计师能力的“数字员工”。</p>
<h2 class="text-xl font-semibold mt-10 mb-5 text-[var(--color-text-primary)] pb-2 tracking-tight group" id="-连-commit-信息都帮我省了"><span class="bg-gradient-to-r pr-4 rounded-l-lg -ml-2 pl-2 py-1">🔧 连 Commit 信息都帮我省了</span></h2>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">最后还有一个戳中我痛点的功能：<strong class="font-semibold text-[var(--color-text-primary)]">Context-Aware Commit</strong>。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">我平时写代码提交，Commit Message 经常就是 <code class="px-1.5 py-0.5 text-[var(--cp-yellow)] bg-[var(--cp-yellow)]/10 font-mono text-[0.85em]">update</code>、`fix`、`wip` 这种毫无营养的词。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">Antigravity 因为全程看着你（和它自己）干了啥，所以它能根据上下文，自动生成非常详细、准确的 Git 提交信息。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">&gt; 这个功能简直是解救强迫症。虽然我估计以后 Git Log 里全是 AI 的口吻，看着会不会有点怪怪的？</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">---</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">反正看完这一通演示，我是觉得 Google 这回是有备而来。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">Antigravity 加上 Gemini 3.0，它给出的愿景不再是“辅助你写字符”，而是“帮你把事儿办了”。从理解需求，到查文档、写代码、画素材、跑测试，最后提交代码，这一条龙服务确实有点东西。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">既然都看到这儿了，你要是觉得这种新技术分享有点意思，就加个<strong class="font-semibold text-[var(--color-text-primary)]">关注</strong>点个<strong class="font-semibold text-[var(--color-text-primary)]">赞</strong>呗，让我知道咱这儿还是有不少喜欢折腾新玩具的朋友的。👋</p></div>
