---
title: "让 AI 替我打工的两个小实验：自动化项目维护与 Issue 售后"
description: "本文分享了作者利用 OpenClaw 打造“数字临时工”的实践经验。通过两个实验，实现了 AI 对开源项目的定时自动维护（更新依赖、修复 Bug）以及智能且礼貌的 GitHub Issue 自动回复。文章探讨了在 AI Agent 时代，独立开发者如何利用工具将机械性重复劳动交给 AI，从而专注于更具创造性的工作。"
date: "2026-04-29T14:39:01.000Z"
tags:
  - "AI Agent"
  - "OpenClaw"
  - "GitHub"
  - "开源维护"
  - "自动化"
  - "效率工具"
  - "独立开发"
pillar: "notes"
tier: "B"
related: []
draft: false
lang: "zh"
---

<div class="cyber-prose max-w-none"><h1 class="text-2xl font-bold mt-10 mb-6 text-[var(--color-text-primary)] tracking-tight" id="openclaw不火了现在来分享两个ai-替我打工的小实验">OpenClaw不火了，现在来分享两个AI 替我打工的小实验</h1>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">最近 AI 圈实在发展太快了，我有时候都怀疑自己是不是已经落后一轮了。前两个月看到 <strong class="font-semibold text-[var(--color-text-primary)]">OpenClaw</strong> 出来，我的心就开始骚动了。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">在家折腾了一个星期，搞出两个挺有意思的小实验。它们都围绕着一个老问题：<strong class="font-semibold text-[var(--color-text-primary)]">能不能让 AI 真正替我干活？</strong></p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">不是陪你聊天、顺手写两句漂亮话的“情感陪伴 AI”，而是能按时上线、照着流程走、出了问题还能给点靠谱反馈的<strong class="font-semibold text-[var(--color-text-primary)]">数字临时工</strong>。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">以下是稳定运行了两个月的实验，今天就跟你们坦白一下。</p>
<h2 class="text-xl font-semibold mt-10 mb-5 text-[var(--color-text-primary)] pb-2 tracking-tight group" id="-先说实验对象一个名字不正经路子却很硬的项目"><span class="bg-gradient-to-r pr-4 rounded-l-lg -ml-2 pl-2 py-1">🎈 先说实验对象：一个名字不正经、路子却很硬的项目</span></h2>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">在聊 OpenClaw 之前，得先把这次的“被实验对象”交代清楚：</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base"><strong class="font-semibold text-[var(--color-text-primary)]"><a href="https://github.com/justlovemaki/git-commit-sao-hua" target="_blank" rel="noopener noreferrer" class="text-brand-500 font-medium hover:text-brand-600 hover:underline decoration-brand-200 hover:decoration-brand-500 underline-offset-4 inline-flex items-center gap-1 transition-all group">justlovemaki/git-commit-sao-hua<svg class="w-3 h-3 opacity-70 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a></strong></p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">名字你们也看到了，叫 <strong class="font-semibold text-[var(--color-text-primary)]">Git Commit 骚话生成器</strong>。它是由我和 AI 头脑风暴想出来的 idea，心想无非就是个程序员自娱自乐的小程序，帮人生成点情话、骚话、中二台词，好让 commit 不那么干巴。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">这项目最开始确实挺轻，就是个静态 HTML 页。可后面越做越不对劲，慢慢开始往工程化那边狂奔。它后来上了 <strong class="font-semibold text-[var(--color-text-primary)]">AST（抽象语法树）分析</strong>，能根据代码变动判断提交类型；再往后，连 <strong class="font-semibold text-[var(--color-text-primary)]">MCP Server</strong> 都接上了。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">这就不是“一个整活工具”那么简单了。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">意思是，像 Claude、Cursor 这种 AI Agent，已经可以直接调它的接口来生成提交文案。它虽然叫“骚话生成器”，骨子里已经发展成了一个功能齐全的多端程序，AI 原生 CLI。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">所以说它不正经吧，名字确实不正经；说它随便吧，它又功能多得离谱。</p>
<h2 class="text-xl font-semibold mt-10 mb-5 text-[var(--color-text-primary)] pb-2 tracking-tight group" id="-实验一让-ai-每天两次自己去维护这个项目"><span class="bg-gradient-to-r pr-4 rounded-l-lg -ml-2 pl-2 py-1">🤖 实验一：让 AI 每天两次，自己去维护这个项目</span></h2>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">既然 AI 已经很强了，那能不能用 <strong class="font-semibold text-[var(--color-text-primary)]">OpenClaw</strong> 给它套一个定时任务，让 AI 每天自己去维护它？</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">答案当然是可以的。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">我让 OpenClaw 写了一个 Skill，设置它每天固定跑两次。核心逻辑不复杂，大概就是：</p>
<ol class="my-6 pl-6 list-decimal space-y-3 text-sm text-[var(--color-text-secondary)]">
<li class="leading-relaxed pl-2 relative marker:text-brand-400 marker:font-medium text-sm"><strong class="font-semibold text-[var(--color-text-primary)]">到时间就读取 issues</strong>，获取人类的 bug 反馈和更新指令；</li>
<li class="leading-relaxed pl-2 relative marker:text-brand-400 marker:font-medium text-sm"><strong class="font-semibold text-[var(--color-text-primary)]">看最近有没有依赖更新</strong>，或者有没有能顺手优化的地方；</li>
<li class="leading-relaxed pl-2 relative marker:text-brand-400 marker:font-medium text-sm"><strong class="font-semibold text-[var(--color-text-primary)]">自动改、自动测</strong>；</li>
<li class="leading-relaxed pl-2 relative marker:text-brand-400 marker:font-medium text-sm"><strong class="font-semibold text-[var(--color-text-primary)]">最后推上去</strong>。</li>
</ol>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">第一次看到 OpenClaw 真把代码提上去的时候，我脑子里只有一个想法：<strong class="font-semibold text-[var(--color-text-primary)]">那个平时只会惹事的傻儿子，突然学会自己洗袜子了。</strong></p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">说实话，那一瞬间我还挺爽的。你能明显感觉到，AI 不再只是个“辅助写字机”，它开始有点像一个真的能接手重复劳动的协作者了。哪怕它现在干的还不是多高深的活，但它已经能把那部分最碎、最烦的维护工作吃下去。</p>
<h2 class="text-xl font-semibold mt-10 mb-5 text-[var(--color-text-primary)] pb-2 tracking-tight group" id="-实验二比我本人还礼貌的-issue-售后"><span class="bg-gradient-to-r pr-4 rounded-l-lg -ml-2 pl-2 py-1">💬 实验二：比我本人还礼貌的 Issue 售后</span></h2>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">第二个实验更实用，也更接近我平时的工作场景。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">独立开发者最怕什么？不是写代码，很多时候是 <strong class="font-semibold text-[var(--color-text-primary)]">Issue 爆炸</strong>。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">忙的时候顾不上看，不回又觉得不理人不好。尤其有人认真提了个问题，你知道自己应该回复，但手头事情一堆，就很容易一直拖着。还有一些很杠的问题，看得让人烦躁，忍不住回怼两句。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">所以我又让 OpenClaw 写了第二个 Skill：<strong class="font-semibold text-[var(--color-text-primary)]">每小时读一次仓库的 Issues，帮我回复处理。</strong></p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">这个 Skill 稍微复杂一点，因为它不是“看一眼再发一句模板话”，它得先判断问题类型：</p>
<ul class="my-6 pl-6 list-disc space-y-3 text-sm text-[var(--color-text-secondary)]">
<li class="leading-relaxed pl-2 relative marker:text-brand-400 marker:font-medium text-sm">如果是<strong class="font-semibold text-[var(--color-text-primary)]">咨询类问题</strong>，就结合 README 和代码库内容给出回复；</li>
<li class="leading-relaxed pl-2 relative marker:text-brand-400 marker:font-medium text-sm">如果是 <strong class="font-semibold text-[var(--color-text-primary)]">Bug</strong>，就尝试理解问题，必要时给出复现思路和修改建议。</li>
</ul>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">实际效果比我预期要好很多。前两周就有个老哥提了个挺偏门的问题。我那会儿还没来得及点开，OpenClaw 已经把步骤整理好回过去了。最后对方还真回了句：</p>
<blockquote class="my-8 pl-6 border-l-4 border-brand-500 bg-brand-50/50 py-4 pr-6 rounded-r-xl italic text-sm text-[var(--color-text-secondary)] relative"><span class="absolute top-2 left-2 text-brand-200 text-2xl leading-none font-serif opacity-50 select-none">&quot;</span><div class="relative z-10">
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">“Thanks, this solved my problem!”</p>
</div></blockquote>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">我盯着那句回复看了半天，心里只有一个想法：<strong class="font-semibold text-[var(--color-text-primary)]">这 AI 比我会做人。</strong></p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">要换成我自己，大概率就是一句 <code class="px-1.5 py-0.5 text-[var(--cp-yellow)] bg-[var(--cp-yellow)]/10 font-mono text-[0.85em]">fixed</code>，或者一句 <code class="px-1.5 py-0.5 text-[var(--cp-yellow)] bg-[var(--cp-yellow)]/10 font-mono text-[0.85em]">check README</code>，能省则省，主打一个已读已回。结果这位数字同事不光回了，还回得挺像样，礼貌、完整、语气稳定，看起来像一个真正愿意做售后的人。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">这事最有意义的地方在于：<strong class="font-semibold text-[var(--color-text-primary)]">它并没有替代我真正想做的那部分创造性工作。它只是把必须做、但确实很机械的活拿走了。</strong> 我不用再把精力耗在“看没看 Issue”、“回没回人”、“这句话措辞够不够客气”这种地方。它帮我把这层处理掉，我就能把时间留给别的事。</p>
<h2 class="text-xl font-semibold mt-10 mb-5 text-[var(--color-text-primary)] pb-2 tracking-tight group" id="-折腾完之后的一点想法"><span class="bg-gradient-to-r pr-4 rounded-l-lg -ml-2 pl-2 py-1">💡 折腾完之后的一点想法</span></h2>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">这两个 Skill 跑起来以后，我有天晚上坐阳台发呆，脑子里一直转一个问题：<strong class="font-semibold text-[var(--color-text-primary)]">现在独立开发的门槛，到底还剩什么？</strong></p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">以前拼的是谁写得快，谁思路更稳，谁能把复杂流程自己一点点搭起来。现在像 OpenClaw 这种工具出来以后，“我有个想法”和“这个想法能跑起来”之间的距离，明显短了很多。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">我不需要先去写一堆 GitHub Action，不需要自己缝 Cron，也不用到处找脚本拼流程。很多时候，我只要把要求说清楚：</p>
<ul class="my-6 pl-6 list-disc space-y-3 text-sm text-[var(--color-text-secondary)]">
<li class="leading-relaxed pl-2 relative marker:text-brand-400 marker:font-medium text-sm"><em class="italic">你每小时去帮我看看有没有人提 Issue。</em></li>
<li class="leading-relaxed pl-2 relative marker:text-brand-400 marker:font-medium text-sm"><em class="italic">有问题就回，回得客气一点。</em></li>
</ul>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">剩下的事，它自己就能接过去。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">当然，AI 现在离“完全自主开发”还早得很。它偶尔还是会整出一些莫名其妙的骚话，或者给你一种“它好像很懂，其实只懂一半”的既视感。但哪怕只把它放在辅助位，它也已经足够好用了。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">至少对我来说，这种感觉挺新鲜：<strong class="font-semibold text-[var(--color-text-primary)]">我不是在单纯地“使用一个工具”，而是在慢慢训练一个会接活的数字伙计。</strong></p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">而这整个过程，本身就挺有意思。说到底，我们这帮人喜欢折腾，不就是因为这个吗？</p>
<hr class="my-10 border-brand-100 border-dashed"/>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base"><strong class="font-semibold text-[var(--color-text-primary)]">最后补几句：</strong></p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">如果你也对这个“表面整活、实际上卷成工程化样板”的项目感兴趣，可以去看看：
👉 <strong class="font-semibold text-[var(--color-text-primary)]">项目地址</strong>：<a href="https://github.com/justlovemaki/git-commit-sao-hua" target="_blank" rel="noopener noreferrer" class="text-brand-500 font-medium hover:text-brand-600 hover:underline decoration-brand-200 hover:decoration-brand-500 underline-offset-4 inline-flex items-center gap-1 transition-all group">justlovemaki/git-commit-sao-hua<svg class="w-3 h-3 opacity-70 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a>
顺手给作者点个 Star，我觉得不过分。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">至于 OpenClaw，我这边已经放弃折腾了，换成了 <strong class="font-semibold text-[var(--color-text-primary)]">Hermes</strong> 接着帮我工作。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">很多人说装了 OpenClaw 没什么用，其实只是你自己没有应用场景。像这种简单、重复的工作，交给 AI 还是可以解放我们的双手的。</p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">至于其它，要 AI 帮你赚钱，首先你得知道怎么做才能赚钱，而不是让 AI 帮你想。<strong class="font-semibold text-[var(--color-text-primary)]">AI 只是你的员工，你才是老板。</strong></p>
<p class="my-5 text-[var(--color-text-secondary)] leading-7 text-base">就说到这，后面要是再跑出什么更离谱、但又真有点用的 Agent 玩法，我再接着来分享。</p></div>
