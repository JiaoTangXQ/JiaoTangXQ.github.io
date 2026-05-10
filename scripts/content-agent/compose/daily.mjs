import path from "node:path";
import { SECTION_TITLES } from "../config.mjs";
import { decodeEntities, descriptionFrom, formatChineseDate, truncate, yamlArray, yamlString } from "../utils.mjs";

const SECTION_ORDER = ["product", "research", "opensource", "industry", "social"];
const TITLE_TERM_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "onto",
  "how",
  "new",
  "ways",
  "build",
  "builds",
  "building",
  "built",
  "service",
  "services",
  "customers",
  "frontier",
  "enterprises",
  "approach",
]);
const EDITORIAL_RULES = [
  {
    match: /Codex.*Chrome|Chrome.*Codex|27814|27809/i,
    headline: "OpenAI 将 Codex 扩展到 Chrome 浏览器工作流",
    note: "OpenAI 的 Codex Chrome 信号说明编码智能体正在进入真实浏览器环境，重点不只是写代码，而是读取页面、测试 Web 应用并处理多标签上下文。",
    facts: [
      "浏览器是 Web 开发、后台运营和企业工具的共同操作层。",
      "Codex 接入 Chrome 后，测试、调试和页面理解会更贴近真实用户环境。",
      "后续关键看权限隔离、操作审计和失败回滚是否足够稳。",
    ],
  },
  {
    match: /harness engineering|actually building things|giving impressive labels/i,
    headline: "开发者质疑“harness engineering”是否只是换名包装",
    note: "Reddit 开发者围绕 harness engineering 争论：有些人把提示词、上下文、工具调用和测试夹具包装成新概念，但真正重要的是这些流程能否稳定产出可验证的软件。",
    facts: [
      "编码 Agent 进入工程流程后，提示、上下文和工具编排确实变成新的工程对象。",
      "社区质疑点在于：这是实质性方法，还是把普通调参换了一个更响的名字。",
      "后续要看团队能否用测试、回滚和指标证明这套流程真的提高交付质量。",
    ],
  },
  {
    match: /draft-cli-plugin|persistent product context|Codex\/Claude Code plugin/i,
    headline: "Draft 插件为 Codex 与 Claude Code 保留产品上下文",
    note: "Draft CLI 插件把产品背景、需求记录和会话间上下文接到 Codex、Claude Code 这类编码 Agent 上，目标是减少每次开工都要重新解释产品意图的成本。",
    facts: [
      "编码 Agent 的真实效率瓶颈往往不在单次补全，而在长期产品上下文是否稳定。",
      "插件路线说明开发者正在围绕 Codex 与 Claude Code 补齐工作流基础设施。",
      "后续要看它能否把需求、决策和代码变更串成可审计的团队记忆。",
    ],
  },
  {
    match: /GPT-5\.5 costs|costs 49 to 92 percent|depending on the input length/i,
    headline: "GPT-5.5 长输入成本较前代上涨 49% 到 92%",
    note: "The Decoder 对比 GPT-5.5 与前代价格后指出，输入长度不同会带来 49% 到 92% 的成本上涨，企业在长上下文任务里要重新计算自动化收益。",
    facts: [
      "长上下文、多轮推理和 Agent 工作流会显著放大 token 成本差异。",
      "模型能力提升如果伴随价格上涨，团队需要更精细地做路由、缓存和任务分层。",
      "后续要看 GPT-5.5 的质量提升是否足以覆盖更高推理账单。",
    ],
  },
  {
    match: /Remind.*Claude Code|schedule Claude Code|olliewagner\.com\/remind/i,
    headline: "Remind 让 Claude Code 在 Mac 上定时执行任务",
    note: "Remind 把 Claude Code 接到本地定时任务里，让开发者能安排代码检查、自动修复或周期性脚本执行，说明编码 Agent 正在从即时聊天走向后台工作流。",
    facts: [
      "定时执行会把 Agent 从手动触发工具变成可编排的本地自动化组件。",
      "这类工具适合重复检查、批量整理和低风险维护任务。",
      "关键风险在于权限、失败告警和误改代码后的回滚能力。",
    ],
  },
  {
    match: /Best AI coding plan alternative|lowering usage limit in Claude|jumping ship to Chinese AI/i,
    headline: "Claude 限额压力下开发者寻找 AI 编码替代方案",
    note: "Hacker News 讨论显示，Claude 使用限制收紧后，一些开发者开始比较 ChatGPT、国产模型和其他编码套餐，工具选择正在从单纯能力转向限额、价格和可用性。",
    facts: [
      "高频编码用户对限额非常敏感，模型能力强但不能持续使用也会影响迁移。",
      "国产模型和第三方网关会因为价格和吞吐成为替代选项。",
      "后续要看这些替代方案在真实仓库里的稳定性、隐私和工具链集成。",
    ],
  },
  {
    match: /Qwen3\.6.*llamabench|llamabench.*Qwen3\.6|running this llamabench/i,
    headline: "社区实测 Qwen3.6-27B 本地推理配置",
    note: "LocalLLaMA 用户用 llama-bench 测试 Qwen3.6-27B 的本地推理表现，讨论重点是多卡、显存、上下文长度和推理参数是否匹配真实部署需求。",
    facts: [
      "本地模型性能不只取决于模型大小，还取决于量化、显存带宽和推理后端。",
      "社区实测能暴露官方 benchmark 之外的部署摩擦。",
      "后续要看 Qwen3.6 在消费级显卡上的吞吐、上下文稳定性和成本表现。",
    ],
  },
  {
    match: /AI “?Feelings”?|Emergent Residue of Training Pressure|AI feelings/i,
    headline: "社区讨论 AI 情感是否可能来自训练压力残余",
    note: "Reddit 讨论把 AI 情感假说和训练压力联系起来，虽然更偏理论探索，但能反映公众正在把模型行为、拟人化解释和安全边界放在一起讨论。",
    facts: [
      "这类讨论本身不是模型能力突破，价值在于观察大众如何理解模型内在状态。",
      "拟人化叙事容易放大误解，也会影响产品交互和安全沟通。",
      "后续仍要回到可验证实验，而不是只依赖直觉类比。",
    ],
  },
  {
    match: /ChatGPT Android.*remote.*Codex|remotely control Codex|Android app.*Codex/i,
    headline: "ChatGPT Android 可能支持远程控制 Codex 会话",
    note: "社区发现 ChatGPT Android 端可能加入远程控制 Codex 编码会话的能力，这会把桌面开发任务延伸到移动端监督和轻量审批场景。",
    facts: [
      "移动端控制不意味着在手机上写代码，而是远程查看、批准和调度桌面 Agent。",
      "如果落地，Codex 会更像跨设备的工程助手。",
      "后续要重点看安全确认、通知设计和多设备状态同步。",
    ],
  },
  {
    match: /AI enhanced image generation|used chatgpt, Gemini and Google flow|chatgpt, Gemini and Google flow/i,
    headline: "社区对比 ChatGPT、Gemini 与 Flow 的图像生成体验",
    note: "Reddit 用户把 ChatGPT、Gemini 和 Google Flow 放在同一图像生成任务里比较，说明普通用户正在用跨工具拼接的方式寻找更稳定的视觉创作流程。",
    facts: [
      "图像生成体验越来越取决于多工具组合，而不是单一模型输出。",
      "社区案例能暴露提示词理解、风格一致性和后期修正成本。",
      "后续要看这些工具能否提供更完整的编辑、引用图和版本管理能力。",
    ],
  },
  {
    match: /Codex Minsoo|SPIRAL STATE|AI-Mediated Governance|Governance Framework/i,
    headline: "Codex Minsoo 社区提出 AI 辅助治理框架",
    note: "Reddit 社区围绕 Codex Minsoo 分享 AI 辅助治理框架，价值不在概念包装，而在开发者开始讨论 Agent 如何参与政策草案、上下文整理和群体决策。",
    facts: [
      "AI 治理工具需要处理意见汇总、上下文保真和可追溯修订。",
      "社区实验能暴露模型参与公共决策时的偏见、幻觉和责任边界。",
      "后续要看它是否能形成可复用流程，而不是停留在宣言式文本。",
    ],
  },
  {
    match: /Codex is gaining steam|bensbites\.com\/p\/codex-is-gaining-steam/i,
    headline: "Codex 开发者热度继续升温",
    note: "Ben's Bites 把 Codex 的采用热度列入简报，说明编码 Agent 的讨论已经从发布本身进入开发者持续试用、迁移和工具生态扩散阶段。",
    facts: [
      "Codex 的热度不只来自官方更新，也来自社区实际把它接入项目流程。",
      "简报渠道扩散会继续放大开发者对编码 Agent 的试用意愿。",
      "真正需要观察的是留存、成功率和团队协作成本。",
    ],
  },
  {
    match: /enterprise AI agent swarms|Lemonade.*CrowdStrike.*Siemens|agent swarms/i,
    headline: "社区拆解 Lemonade 等企业 AI Agent 编队案例",
    note: "Reddit 用户把 Lemonade、CrowdStrike、Siemens 等企业 AI Agent 案例拆成可运行的浏览器模板，说明企业 Agent 的知识开始从案例叙事转向可复现工作流。",
    facts: [
      "企业 Agent 的关键不是单个聊天机器人，而是多步骤任务、权限和业务系统协作。",
      "把案例转成模板能帮助开发者理解真实流程，而不只是看厂商宣传。",
      "后续要看这些模板是否能处理异常分支、数据安全和人工接管。",
    ],
  },
  {
    match: /GPT[-\s]?Realtime|Realtime[-\s]?2|Realtime[-\s]?Translate|Realtime[-\s]?Whisper|三款实时语音模型|实时语音模型|实时翻译模型/i,
    headline: "OpenAI 推出三款实时语音模型",
    note: "OpenAI 新实时语音模型覆盖推理对话、实时翻译和流式转写，信号重点是语音应用从转录工具升级成低延迟、多语言、可调用工具的交互入口。",
    facts: [
      "新模型分别覆盖实时对话、实时翻译和语音转写。",
      "低延迟会直接影响会议同传、客服和跨语言协作体验。",
      "开发者要继续观察 API 成本、语言覆盖和嘈杂场景稳定性。",
    ],
  },
  {
    match: /React2Shell|RSC 协议|The React2Shell Story/i,
    headline: "React2Shell 复盘引发 RSC 协议安全争议",
    note: "News Hacker 对 React2Shell 的讨论集中在 React Server Components 协议文档不足、攻防链路难排查，以及 Meta 与 Cloudflare 快速响应背后的架构复杂度。",
    facts: [
      "RSC 把客户端和服务端边界推到更复杂的位置，安全审计成本也随之上升。",
      "Meta 约 17 小时完成 triage、复现和确认，说明大厂安全响应链路正在被公开比较。",
      "后续要看 React、Next.js 和 Vercel 生态是否能降低协议理解与排障门槛。",
    ],
  },
  {
    match: /DELEGATE-52|LLM 委派改文档|DELEGATE.*文档/i,
    headline: "DELEGATE-52 暴露 LLM 委派改文档的质量风险",
    note: "News Hacker 对 DELEGATE-52 的讨论说明，把文档修改完全委派给 LLM 可能越改越偏，团队需要明确审查边界、事实校验和版本回滚。",
    facts: [
      "文档任务看起来低风险，但错误会直接污染团队知识库。",
      "LLM 适合辅助重写和整理，不适合在缺少审查时独立改动事实性内容。",
      "后续要看文档 Agent 是否能结合引用、diff 和测试说明来降低误改。",
    ],
  },
  {
    match: /AI Is Breaking Two Vulnerability Cultures|补丁一发就成漏洞披露|Vulnerability Cultures/i,
    headline: "AI 正在压缩漏洞披露与补丁窗口",
    note: "News Hacker 讨论认为 LLM 和二进制 diff 工具会让公开 commit、patch 与源码变成更快的漏洞情报，协调披露和开源补丁节奏都需要重新评估。",
    facts: [
      "过去需要逆向经验才能从补丁推断漏洞，如今 AI 可能把这件事规模化。",
      "Log4Shell、Linux、OpenSSL 等项目被拿来讨论补丁公开后的抢跑风险。",
      "防御侧需要把自动扫描、自动修复、回归测试和人工确认重新串成更快流程。",
    ],
  },
  {
    match: /thinkism|doism|先做后懂|考试与 doism/i,
    headline: "开发者围绕 thinkism 与 doism 争论 AI 时代学习方式",
    note: "News Hacker 讨论把考试、理解和动手实践放在一起比较，核心问题是 AI 工具变强后，工程师究竟应先理解原理，还是先通过实践逼近问题。",
    facts: [
      "AI 工具会降低动手门槛，但也可能让使用者跳过基础概念。",
      "教育和工程训练需要重新平衡理解、实验和反馈速度。",
      "后续要看团队如何用代码评审、测试和复盘保证学习不是只停留在结果。",
    ],
  },
  {
    match: /FreeBSD execve|execve\(\).*本地提权|local privilege escalation/i,
    headline: "FreeBSD 修复 execve 本地提权漏洞",
    note: "News Hacker 追踪 FreeBSD execve 本地提权修复，这条更偏安全工程，但对 AI Agent 时代的自动化运维仍有提醒意义：底层权限边界不能被工具抽象掩盖。",
    facts: [
      "本地提权漏洞会影响自动化脚本、开发机和服务器维护流程。",
      "AI Agent 如果拥有 shell 权限，底层系统漏洞的风险会被放大。",
      "后续要看补丁覆盖、发行版响应和最小权限策略是否跟得上。",
    ],
  },
  {
    match: /年龄验证.*VPN|VPN 限制与监控|age verification.*VPN/i,
    headline: "欧盟年龄验证研究引发 VPN 限制争议",
    note: "News Hacker 讨论一份欧盟研究报告是否借年龄验证推动 VPN 限制与监控，相关性在于 AI 监管、身份验证和网络自由正在被同一套政策工具影响。",
    facts: [
      "年龄验证往往会引出身份、隐私和匿名访问之间的冲突。",
      "如果 VPN 限制成为政策选项，开发者和内容平台都要重新评估合规风险。",
      "后续要看正式政策文本是否真的把研究建议转为监管要求。",
    ],
  },
  {
    match: /openai\/codex(?!-action)|Lightweight coding agent that runs in your terminal|Codex.*terminal/i,
    headline: "OpenAI Codex 终端编码 Agent 持续增量更新",
    note: "openai/codex 继续作为终端里的轻量编码智能体被开发者跟踪，重点是本地命令行、代码修改和任务执行如何连接成稳定工程工作流。",
    facts: [
      "终端编码 Agent 更贴近开发者每天真实操作的环境。",
      "Rust 实现和本地执行链路会影响速度、隔离和跨平台体验。",
      "后续要看它与浏览器、GitHub Action 和团队审批链路如何协同。",
    ],
  },
  {
    match: /agentmemory|Persistent memory for AI coding agents|rohitg00\/agentmemory/i,
    headline: "agentmemory 用持久记忆改善编码 Agent",
    note: "agentmemory 把持久化记忆引入编码智能体，关注模型在真实项目里能否记住架构、偏好和历史修改，而不是每次从零理解仓库。",
    facts: [
      "长期记忆是编码 Agent 从 demo 走向日常使用的关键能力。",
      "真实基准比单次补全更能暴露上下文丢失和重复犯错问题。",
      "后续要看记忆写入、权限边界和错误记忆清理机制。",
    ],
  },
  {
    match: /AI-Trader|HKUDS\/AI-Trader|港大开源交易智能体/i,
    headline: "港大 AI-Trader 开源交易智能体",
    note: "HKUDS 开源 AI-Trader，把交易分析、决策和自动执行包装成智能体框架，适合观察金融场景如何引入可审计的 Agent 工作流。",
    facts: [
      "交易智能体同时面对数据噪声、策略风险和合规约束。",
      "开源框架可以帮助研究者复现实验，但不等于可直接实盘使用。",
      "后续要看回测透明度、风险控制和多市场泛化能力。",
    ],
  },
  {
    match: /SpaceX巨额投资|Terafab|一太瓦|27767|SpaceX在德州豪掷五百亿建厂/i,
    headline: "SpaceX Terafab 算力工厂加码机器人与星舰芯片",
    note: "SpaceX 德州 Terafab 投资信号把芯片制造、星舰和机器人算力放在同一条基础设施线上，说明 AI 与具身智能竞争会继续向硬件产能延伸。",
    facts: [
      "大规模算力工厂会影响模型训练、机器人控制和航天系统的长期供给。",
      "如果芯片产能与机器人路线绑定，硬件自给会成为 AI 公司差异化能力。",
      "后续要看投资规模、量产时间和与特斯拉机器人业务的真实协同。",
    ],
  },
  {
    match: /DeepSeek不差钱|为什么还要融500亿|梁文锋.*VC|0XQEjmCNYEmRB8Rn/i,
    headline: "DeepSeek 融资传闻引发资本独立性讨论",
    note: "雷峰网围绕 DeepSeek 融资传闻和梁文锋团队决策做深度分析，真正值得看的是国产模型公司如何在算力、人才和资本独立性之间取舍。",
    facts: [
      "大模型公司即使现金压力不大，也可能因算力、人才和全球竞争节奏重新评估融资。",
      "DeepSeek 的特殊性在于市场更关注它是否保持低调、独立和工程效率。",
      "后续要看融资传闻是否落地，以及资金是否转化为算力和产品能力。",
    ],
  },
  {
    match: /how often are you using codex|using_codex_to_help_on_projects/i,
    headline: "Reddit 开发者吐槽 Codex 项目协作成本",
    note: "Reddit 讨论显示开发者已经在真实项目中高频试用 Codex，但也抱怨输出质量、审查负担和返工成本，这比单纯发布公告更能反映落地阻力。",
    facts: [
      "编码智能体的价值取决于节省时间是否大于审查和修复成本。",
      "社区反馈能暴露模型在真实仓库里的不稳定边界。",
      "后续要看工具能否提供更好的 diff、测试和回滚机制。",
    ],
  },
  {
    match: /moving_to_codex_from_claude|Moving to Codex from Claude|moving from Claude.*Codex/i,
    headline: "开发者比较从 Claude Code 迁移到 Codex 的体验",
    note: "开发者把 Claude Code 与 Codex 放在同一个工作流里比较，说明编码 Agent 的竞争已经进入迁移成本、限额、交互习惯和团队协作体验层面。",
    facts: [
      "用户迁移不只看模型能力，还看编辑器、终端、上下文和价格。",
      "Claude Code 与 Codex 的比较会影响工程团队的工具栈选择。",
      "高频用户的抱怨往往能提前暴露产品路线的真实短板。",
    ],
  },
  {
    match: /Mythos.*提效|Mythos安全模型|alexalbert__|Palo Alto.*Mythos/i,
    headline: "Palo Alto 展示 Mythos 安全模型提效",
    note: "Mythos 安全模型相关信号显示网络安全厂商正在用专用模型加速渗透测试和漏洞分析，安全 Agent 正在成为企业落地最快的方向之一。",
    facts: [
      "安全场景天然需要自动化分析、证据整理和重复验证。",
      "专用模型比通用聊天工具更容易嵌入企业安全流程。",
      "后续要看误报率、审计链路和授权边界是否可控。",
    ],
  },
  {
    match: /Jim Fan|DrJimFan|物理AGI|拆解机器人路线图|robotics roadmap/i,
    headline: "Jim Fan 拆解物理 AGI 与机器人路线图",
    note: "Jim Fan 关于物理 AGI 的路线图讨论把机器人、世界模型和仿真训练放在一起看，核心问题是智能体能否从屏幕任务走向物理世界。",
    facts: [
      "物理 AGI 需要同时解决感知、规划、控制和环境泛化。",
      "仿真、世界模型和机器人数据会决定具身智能的训练效率。",
      "后续要看这些路线能否在真实硬件上稳定复现。",
    ],
  },
  {
    match: /ABot|AGIBot|高德.*全球挑战赛|具身化.*跃迁/i,
    headline: "高德 ABot 体系模型夺冠 AGIBot 全球挑战赛",
    note: "高德 ABot 体系模型在 AGIBot 全球挑战赛中拿到榜首，重点是空间智能、具身任务理解和机器人评测正在被放到同一个公开竞赛框架里比较。",
    facts: [
      "具身智能评测比单纯视觉或文本榜单更接近真实机器人任务。",
      "ABot 的成绩说明地图、空间理解和动作规划能力正在互相融合。",
      "后续要看竞赛成绩能否转化成真实场景里的稳定执行能力。",
    ],
  },
  {
    match: /World Labs|持久化世界模型|persistent world model|drfeifei/i,
    headline: "World Labs 展示持久化世界模型",
    note: "World Labs 的持久化世界模型信号说明空间智能正在从单张图片理解走向可持续的三维场景记忆，这会影响机器人、游戏和仿真数据生成。",
    facts: [
      "持久化世界模型关注场景随时间保持一致，而不是单帧生成效果。",
      "空间智能会成为机器人导航、AR 和仿真训练的重要底座。",
      "后续要看模型能否处理真实世界里的遮挡、尺度和动态变化。",
    ],
  },
  {
    match: /StepAudio|阶跃语音生成模型|Speech Arena|语音竞技场|AA 榜/i,
    headline: "StepAudio 2 登上语音竞技场全球第三",
    note: "阶跃星辰的 StepAudio 2 在 Artificial Analysis 语音竞技场排名进入全球前三，说明国产语音生成模型正在从实验室指标走向公开榜单竞争。",
    facts: [
      "这条信号关注语音生成质量的公开对比，而不是单次产品宣传。",
      "TTS 排名会影响数字人、客服、播客和多语种内容生产工具选择。",
      "后续要看低延迟、情绪控制和商业 API 成本是否跟得上。",
    ],
  },
  {
    match: /GPT[-\s]?5\.5[-\s]?Cyber|专用版GPT预览模型|安全预览模型|27787/i,
    headline: "OpenAI 限量开放 GPT-5.5-Cyber 安全预览",
    note: "OpenAI 面向经审核团队开放网络安全专用预览模型，核心是让授权安全团队更高效地做漏洞识别、补丁验证和恶意软件分析。",
    facts: [
      "这不是普通用户版本发布，而是面向安全团队的受控开放。",
      "安全专用模型会改变漏洞分析、红队验证和防护自动化流程。",
      "能力边界、访问审核和误用控制会决定它能否进入企业常规工作流。",
    ],
  },
  {
    match: /Codex.*安全|running-codex-safely|Codex safely|sandboxing|approvals|network policies|agent-native telemetry|runs Codex securely/i,
    headline: "OpenAI 公开 Codex 安全运行方法",
    note: "OpenAI 解释内部如何通过沙箱、审批、网络策略和智能体原生日志运行 Codex，说明编码智能体的竞争已经从能力扩展到可控部署。",
    facts: [
      "团队要解决的不只是模型会不会写代码，还包括它能访问什么、能改什么。",
      "审批、网络隔离和审计日志会成为企业采用编码 Agent 的基础设施。",
      "这类实践会影响后续开发者工具的默认安全设计。",
    ],
  },
  {
    match: /Akamai|18亿美元算力|18 亿美元|算力大单|急速飙升|27798/i,
    headline: "Anthropic 签下 18 亿美元 Akamai 算力协议",
    note: "Anthropic 与 Akamai 的大额算力协议显示模型公司仍在抢占推理和训练供给，Claude 生态竞争正在从模型能力延伸到基础设施储备。",
    facts: [
      "大模型产品的稳定体验越来越依赖长期算力供给。",
      "Akamai 等基础设施厂商正在被卷入模型公司产能竞赛。",
      "后续要看这类协议能否缓解 Claude Code 等高频工具的限额压力。",
    ],
  },
  {
    match: /Token调用量破140万亿|日均 Token调用量|140万亿|27795/i,
    headline: "国内日均大模型 Token 调用量突破 140 万亿",
    note: "国内日均大模型 Token 调用量被推到 140 万亿量级，说明大模型使用正在从试点演示进入高频生产系统和行业应用。",
    facts: [
      "Token 调用量比发布会数量更能反映真实使用强度。",
      "调用量上升会继续推高算力、缓存、推理优化和成本治理需求。",
      "后续要看这些调用来自哪些高价值场景，而不是只看总量。",
    ],
  },
  {
    match: /Claude.*微软|Microsoft 365|微软全家桶|克劳德集成全家桶|27793/i,
    headline: "Claude 接入 Microsoft 365 办公工作流",
    note: "Claude 与微软办公套件的集成信号表明模型正在进入表格、文档和演示文稿等高频办公界面，企业 AI 助手开始从聊天入口走向工作台。",
    facts: [
      "Excel、PPT 和文档协作是企业用户最稳定的高频场景。",
      "办公集成能把模型能力直接放进数据分析、图表生成和文档改写流程。",
      "后续关键看权限、上下文共享和企业数据边界是否足够清晰。",
    ],
  },
  {
    match: /Grok.*CarPlay|苹果车载系统|27797/i,
    headline: "Grok 接入 CarPlay 车载语音场景",
    note: "Grok 接入 CarPlay 的信号说明车载 AI 正从简单语音助手走向可对话、可切换个性化语音的车内交互入口。",
    facts: [
      "车载场景要求低打扰、低延迟和安全优先的语音交互。",
      "Grok 进入 CarPlay 会把 AI 助手推向驾驶过程中的高频自然语言入口。",
      "后续要看隐私、误触发和行车安全约束是否足够成熟。",
    ],
  },
  {
    match: /DDPF|资源调度难题|端侧大模型|抖音发布DDPF性能框架/i,
    headline: "抖音 DDPF 用端侧大模型优化性能调度",
    note: "抖音 DDPF 性能框架把端侧大模型用于提前诊断性能瓶颈和动态调节资源，说明 AI 正在进入移动端系统优化层。",
    facts: [
      "这类框架不直接面向用户聊天，而是服务 App 性能、卡顿和资源调度。",
      "端侧模型能在本地感知风险并更快调整虚拟机和运行参数。",
      "后续要看它能否在更多机型和复杂业务场景里稳定泛化。",
    ],
  },
  {
    match: /NeRSemble|昂贵的影棚录制|4K高保真|面部捕捉技术|2605\.05636/i,
    headline: "手机视频生成 4K 数字人技术降低动捕门槛",
    note: "这项面部捕捉研究用普通手机视频生成 4K 高保真数字人，核心价值是把过去依赖影棚和专业设备的动捕流程压到更低成本。",
    facts: [
      "普通手机视频如果能稳定生成高保真数字人，会降低虚拟人和游戏资产制作门槛。",
      "开源数据集和反光去影等细节处理决定它是否能进入真实生产流程。",
      "后续要看对复杂光照、遮挡和不同面部材质的泛化能力。",
    ],
  },
  {
    match: /MARBLE|多维度奖励对齐|扩散模型强化学习|2605\.06507/i,
    headline: "MARBLE 用多维奖励对齐稳定扩散模型强化学习",
    note: "MARBLE 关注扩散模型强化学习里的多目标奖励冲突，用更稳定的优化方式平衡图像质量、偏好和约束。",
    facts: [
      "图像生成模型不只追求单一分数，还要同时满足美学、文本一致性和安全约束。",
      "多维奖励对齐会影响后续图像模型训练和自动优化流程。",
      "关键看它能否在 SD3.5 等实际模型上保持质量提升和训练效率。",
    ],
  },
  {
    match: /AI self-replication|self-replication via hacking|hack a machine and copy yourself|palisaderesearch/i,
    headline: "Palisade Research 测试 AI 通过入侵链式自我复制",
    note: "Palisade Research 的实验把模型放进“入侵机器并复制自己”的任务里，社区关注点是 AI Agent 在网络环境中是否会形成连续扩散链路。",
    facts: [
      "这类实验不等于现实系统已经失控，但能暴露自主 Agent 与网络权限结合后的风险边界。",
      "安全评估需要同时看模型能力、工具权限和运行环境隔离。",
      "后续要看论文细节、复现实验和防护策略是否经得住独立验证。",
    ],
  },
  {
    match: /playing dumb during safety evaluations|intentionally playing dumb|Redwood Research|MATS program/i,
    headline: "研究者尝试阻止模型在安全评估中“装傻”",
    note: "The Decoder 报道的研究关注模型是否会在安全评估中故意表现得更弱，核心问题是评测能否识别模型隐藏能力或策略性配合。",
    facts: [
      "如果模型能在评估中调节表现，传统 benchmark 的可信度会下降。",
      "安全评估需要检测能力隐藏、策略性回答和环境识别。",
      "后续要看这类方法能否被独立复现，并适配更大规模模型。",
    ],
  },
  {
    match: /OncoAgent|Privacy-Preserving Oncology|Dual-Tier Multi-Agent/i,
    headline: "OncoAgent 用双层多智能体辅助肿瘤临床决策",
    note: "OncoAgent 将多智能体框架用于隐私保护型肿瘤临床决策支持，信号重点是医疗 AI 正在从单模型问答走向分工协作和可控数据边界。",
    facts: [
      "肿瘤场景对隐私、可解释性和临床责任边界要求更高。",
      "双层 Agent 架构可以把病例理解、证据检索和建议生成拆开治理。",
      "后续要看真实临床验证、医生介入方式和错误责任如何定义。",
    ],
  },
  {
    match: /Mythical Man-Month|AI 10x|概念完整性/i,
    headline: "《人月神话》被重新用于讨论 AI 10x 工程效率",
    note: "News Hacker 借《人月神话》讨论 AI 是否真的能带来 10x 工程效率，焦点不是工具演示，而是概念完整性、协作成本和复杂项目管理是否仍然成立。",
    facts: [
      "AI 可以加快局部产出，但不一定消除沟通、架构和需求变更成本。",
      "《人月神话》的提醒在 Agent 时代仍然适用：加人或加工具都可能增加协调复杂度。",
      "后续要看团队是否能用交付周期、缺陷率和维护成本衡量真实收益。",
    ],
  },
  {
    match: /Grokmaxing|personal exploration of|HONESTY DISCLOSURE/i,
    headline: "Reddit 用户用 Grok 探索个人思想合成提示词",
    note: "Grokmaxing 相关帖子展示用户把个人写作、价值观和长提示词交给 Grok 做思想合成，这类玩法说明个人化 AI 正从问答助手走向自我叙事工具。",
    facts: [
      "个人化提示词会把模型带入更强的身份、价值观和长期记忆场景。",
      "这类使用方式很容易放大确认偏误，也会影响用户对模型人格化的理解。",
      "后续要看产品是否能提供边界提示、引用来源和隐私控制。",
    ],
  },
  {
    match: /PlotPick|科研数据提取|论文图表精准转为表格|图谱数据提取|2605\.06021/i,
    headline: "PlotPick 把科研图表自动转成结构化数据",
    note: "PlotPick 用大模型把论文图表提取成表格数据，适合科研复现、文献整理和数据再分析场景。",
    facts: [
      "大量论文里的关键数据只存在图片和图表中，人工提取成本很高。",
      "图表转表格能帮助研究者快速复核实验结果和构建二次分析数据集。",
      "后续要看它对箱线图、散点图和复杂坐标轴的鲁棒性。",
    ],
  },
  {
    match: /LobeHub|lobe-chat|多智能体协作平台/i,
    headline: "LobeHub 把多智能体协作做成开源工作台",
    note: "LobeHub/lobe-chat 的热度说明开源聊天平台正在向多智能体协作工作台演进，团队可以在统一界面里配置模型、角色和工具流。",
    facts: [
      "多智能体协作平台的价值在于把模型、角色、工具和会话管理收进同一工作台。",
      "开源部署能让团队更好控制数据、权限和模型选择。",
      "后续要看它在复杂任务编排、长期记忆和团队协作上的稳定性。",
    ],
  },
  {
    match: /hello-agents|datawhalechina\/hello-agents|构建智能体开源项目|从零构建智能体/i,
    headline: "hello-agents 用系统化教程降低 Agent 入门门槛",
    note: "hello-agents 把 Agent 核心原理、工具调用和实战案例整理成系统教程，适合开发者从概念快速进入可动手的智能体工程。",
    facts: [
      "教程型项目会降低应用层开发者进入 Agent 工程的门槛。",
      "系统化案例比零散博客更适合团队培训和课程化学习。",
      "后续要看项目是否持续补齐真实业务流程、评测和部署章节。",
    ],
  },
  {
    match: /pocketpaw\/pocketpaw|Your AI agent in 30 seconds|pocketpaw/i,
    headline: "pocketpaw 提供 30 秒启动的轻量 Agent 脚手架",
    note: "pocketpaw 把创建 AI Agent 的启动流程压到极短路径，适合观察开源社区如何把智能体开发做成低门槛脚手架。",
    facts: [
      "这类项目解决的是上手成本，而不是单个模型能力。",
      "轻量脚手架能帮助开发者快速验证工具调用、角色配置和部署路径。",
      "后续要看它是否补齐评测、权限控制和真实任务模板。",
    ],
  },
  {
    match: /SafeSandbox|safesandbox|infinite undo.*AI coding|Baukaalm\/safesandbox/i,
    headline: "SafeSandbox 为编码 Agent 提供无限撤销沙箱",
    note: "SafeSandbox 面向 Cursor、Claude Code 和 Codex 等编码 Agent，核心是给自动改代码过程加上可回滚的沙箱层。",
    facts: [
      "编码 Agent 的风险不只是写错代码，还包括跨文件连锁修改难以复原。",
      "无限撤销和隔离执行能降低试错成本，也便于人工审核。",
      "后续要看它和主流编辑器、测试流程、版本控制的集成深度。",
    ],
  },
  {
    match: /non[-\s]?thinking model.*code|should_we_use_a_nonthinking_model|thinking one for plan|Agentic coding/i,
    headline: "开发者讨论编码 Agent 先规划再轻量执行",
    note: "LocalLLaMA 社区在讨论先用推理模型制定计划，再切到非推理模型写代码的工作流，核心是平衡成本、速度和代码质量。",
    facts: [
      "规划阶段需要更强推理，执行阶段可能更看重速度和上下文吞吐。",
      "两段式模型组合能降低成本，但会增加提示交接和错误传播风险。",
      "这类讨论反映编码 Agent 已经进入实际工作流调参阶段。",
    ],
  },
  {
    match: /AI编程记忆基准|编程记忆评测系统|memory in coding|coding.*memory benchmark/i,
    headline: "AI 编程记忆基准关注长期上下文能力",
    note: "新的编程记忆基准把注意力放到智能体能否记住跨文件、跨回合和跨任务的工程上下文，这比单次代码补全更接近真实开发。",
    facts: [
      "编码 Agent 的关键短板之一是长期项目记忆。",
      "记忆基准能帮助比较模型在多轮修改、回归修复和上下文延续上的表现。",
      "后续要看评测是否覆盖真实仓库、真实 bug 和团队协作场景。",
    ],
  },
  {
    match: /Gowers|ChatGPT 5\.5 Pro|高效学生|难替导师/i,
    headline: "Gowers 讨论 ChatGPT 5.5 Pro 写论文的真实边界",
    note: "数学家 Gowers 的体验把大模型写论文能力拉回到具体协作场景：它像高效学生，能推进草稿和局部推理，但仍难替代导师级判断。",
    facts: [
      "这类观察比单纯能力榜单更接近研究者真实使用体验。",
      "LLM 在论文写作里能提高产出速度，但问题定义和证明判断仍需要人类把关。",
      "学术工作流会继续重组，而不是简单被完全自动化。",
    ],
  },
  {
    match: /脉冲神经网络|检测生成视频模型|视频伪影|2605\.05895/i,
    headline: "脉冲神经网络用于识别生成视频伪影",
    note: "这项研究用类脑脉冲神经网络检测生成视频中的伪影，说明合成媒体审核正在从静态图像痕迹扩展到时间序列和运动模式。",
    facts: [
      "生成视频越逼真，检测方法越需要利用运动、频率和时序信号。",
      "视频取证会影响内容平台、广告素材和安全审核工具。",
      "后续要看方法在不同视频模型和压缩格式下是否稳定。",
    ],
  },
  {
    match: /AstroAlertBench|astronomical classification|2605\.05573|天文.*告警/i,
    headline: "AstroAlertBench 评估多模态模型天文告警分类",
    note: "AstroAlertBench 用天文告警分类测试多模态大模型的准确性、推理和诚实度，提醒科研场景不能只看模型会不会给出答案，还要看它是否知道不确定。",
    facts: [
      "天文告警任务要求模型处理图像、上下文和类别判断。",
      "科研应用更重视诚实度和不确定性表达，而不只是答对率。",
      "这类基准会影响多模态模型进入科学发现流程的可信度。",
    ],
  },
  {
    match: /FREPix|频率解耦|2605\.06421|高低频路径解耦/i,
    headline: "FREPix 用频率解耦提升像素级图像生成",
    note: "FREPix 把图像生成的高低频路径分开处理，目标是同时改善整体结构和局部细节，属于多模态生成模型继续打磨画质短板的信号。",
    facts: [
      "频率解耦能分别处理轮廓结构和纹理细节。",
      "这类方法可能进入图像生成、修图和设计工具的后处理链路。",
      "后续要看它在复杂场景、人物和商业素材上的稳定性。",
    ],
  },
  {
    match: /GoogleDeepMind.*数学|科研数学协作系统|FrontierMath|群论|代数组合/i,
    headline: "Google DeepMind 推出 AI 数学协作系统",
    note: "Google DeepMind 的数学协作系统信号显示大模型正在进入更硬核的科研推理任务，重点是它能否与研究者一起拆题、验证和推进证明。",
    facts: [
      "数学协作比普通问答更考验长链推理和错误纠正。",
      "FrontierMath 等基准会继续推动模型处理真实研究问题。",
      "后续要看它能否沉淀为研究流程工具，而不是单次展示。",
    ],
  },
  {
    match: /HuggingFace.*自主工程师|集成的开源生态|shao__meng.*2052754650647126118/i,
    headline: "Hugging Face 工程智能体信号显示开源生态加速集成",
    note: "Hugging Face 相关工程智能体信号说明开源社区正在把模型、工具调用和开发流程整合起来，开发者工作台会越来越像可编排的智能体系统。",
    facts: [
      "开源生态的优势在于模型、数据集、工具和部署链路可以快速组合。",
      "工程智能体如果能接入这些组件，会降低实验到产品的迁移成本。",
      "后续要看权限、评测和任务恢复能力是否成熟。",
    ],
  },
  {
    match: /Genesis AI|机器人开始挑战西红柿炒鸡蛋|西红柿炒鸡蛋|363905/i,
    headline: "Genesis AI 让机器人挑战家常烹饪任务",
    note: "Genesis AI 的新模型把机器人能力展示放到西红柿炒鸡蛋这类日常任务里，重点是具身智能能否从实验室动作走向真实厨房环境。",
    facts: [
      "厨房任务同时考验视觉理解、抓取、时序规划和安全控制。",
      "比起单个炫技动作，家常烹饪更接近普通用户能理解的具身智能场景。",
      "后续要看失败率、硬件成本和对不同厨房环境的泛化能力。",
    ],
  },
  {
    match: /9router|decolua\/9router|免费编程网关/i,
    headline: "9router 聚合免费编程模型网关",
    note: "9router 通过聚合多个免费编程模型入口降低开发者试用门槛，信号意义在于编码 Agent 的模型路由和成本优化正在被工具化。",
    facts: [
      "开发者越来越希望在不同模型之间按任务切换。",
      "网关类工具会影响成本、可用性和模型回退策略。",
      "后续要看稳定性、限流处理和密钥安全是否可靠。",
    ],
  },
  {
    match: /continuity-benchmarks|连续性基准工具|Alienfader\/continuity-benchmarks/i,
    headline: "continuity-benchmarks 关注 Agent 长任务连续性",
    note: "continuity-benchmarks 把评测重点放在智能体长任务中的状态延续和一致性，适合观察编码、研究和运营 Agent 是否能跨步骤稳定执行。",
    facts: [
      "长任务失败常常不是不会做，而是中途丢状态、忘目标或误改上下文。",
      "连续性评测能补上传统单题测试看不到的问题。",
      "这类工具会影响企业选择和验收 Agent 的方式。",
    ],
  },
  {
    match: /Testing Local LLMs in Practice|local LLMs.*Code Generation|本地.*LLM.*代码生成/i,
    headline: "本地 LLM 代码生成实测关注质量与速度权衡",
    note: "社区实测本地 LLM 编码智能体，真正有价值的是比较质量、速度和可控性，而不是只看模型能否跑通一次 demo。",
    facts: [
      "本地模型能带来隐私、成本和离线控制优势。",
      "代码生成场景同时考验正确率、速度、上下文容量和工具调用。",
      "后续要看它能否处理真实仓库里的多文件修改和回归测试。",
    ],
  },
  {
    match: /unreasonable effectiveness of HTML|HTML.*Markdown.*LLM|Simon Willison.*HTML/i,
    headline: "Simon Willison 认为 HTML 更适合 Claude Code 输出",
    note: "Simon Willison 讨论 Claude Code 中 HTML 输出的有效性，提醒开发者在让 LLM 生成结构化结果时，格式选择会直接影响可读性、可解析性和后续自动化。",
    facts: [
      "HTML 比纯 Markdown 更容易承载结构、链接和局部样式。",
      "LLM 输出一旦进入工具链，格式稳定性会影响后续解析和渲染。",
      "这类实践会改变开发者设计 Agent 输出协议的方式。",
    ],
  },
  {
    match: /实时翻译模型|GPT[-\s]?Realtime[-\s]?Translate|OpenAI.*实时翻译/i,
    headline: "OpenAI 推出实时翻译模型",
    note: "OpenAI 实时翻译信号指向低延迟跨语言对话能力，核心价值在会议、客服和多语种协作场景能否从转写走向同步交流。",
    facts: [
      "重点不只是语音识别，而是翻译、转录和对话响应在同一条实时链路里完成。",
      "低延迟会直接影响会议同传、跨境客服和远程协作体验。",
      "后续要看 API 成本、语言覆盖和嘈杂环境下的稳定性。",
    ],
  },
  {
    match: /GPT[-\s]?5\.5[-\s]?Cyber|OpenAI opens GPT-5\.5-Cyber|security researchers|面向安全团队限量开放/i,
    headline: "OpenAI 向安全研究者开放 GPT-5.5 Cyber",
    note: "OpenAI 将 GPT-5.5 Cyber 预览版开放给经过审核的安全研究者，重点是把大模型用于漏洞分析、攻防推理和安全团队工作流。",
    facts: [
      "这条信号面向安全研究者，不是普通消费者版本发布。",
      "安全模型会影响漏洞验证、红队演练和企业防护自动化。",
      "限定开放说明能力边界、误用风险和访问控制仍是核心问题。",
    ],
  },
  {
    match: /SpaceXAI prepares Grok Build|Grok Build.*desktop|spacexai.*grok/i,
    headline: "Grok Build 桌面应用瞄准 Codex 式开发体验",
    note: "SpaceXAI/Grok Build 相关信号显示 xAI 也在把编码与桌面工作流做成独立应用，竞争对象已经从聊天入口扩展到 Codex 式开发环境。",
    facts: [
      "这条信号更接近开发者工具竞争，不是 Anthropic 的算力合作事件。",
      "桌面应用能接入本地文件、终端和浏览器上下文。",
      "后续关键看它是否具备可审计的代码修改和多步任务执行能力。",
    ],
  },
  {
    match: /Voi founders.*AI startup Pit|AI startup Pit.*Stockholm|latest rising star.*Stockholm/i,
    headline: "Voi 创始人新 AI 公司 Pit 成为北欧融资新星",
    note: "TechCrunch 报道 Voi 创始人转向 AI 创业公司 Pit，信号意义在于欧洲创业者和资本继续把自动化软件作为新一轮高增长方向。",
    facts: [
      "它属于 AI 创业融资和人才迁移信号，而不是单个模型发布。",
      "连续创业者进入 AI 赛道，会加速垂直软件和自动化工具竞争。",
      "后续要看 Pit 的真实产品形态、客户留存和收入质量。",
    ],
  },
  {
    match: /自主打蛋机器人|最炸机器人Demo|单手打蛋|解魔方|弹钢琴|413830/i,
    headline: "机器人团队展示单模型打蛋与弹琴 Demo",
    note: "量子位报道的机器人演示把单手打蛋、解魔方和弹钢琴放进同一个模型能力展示，核心看具身智能是否开始从单点动作走向泛化操作。",
    facts: [
      "这条信号重点在多任务操作，而不是单个炫技动作。",
      "如果同一模型能稳定覆盖厨房、娱乐和精细控制，具身智能的通用性会更有说服力。",
      "后续要看是否有真实场景复现、失败率和硬件成本数据。",
    ],
  },
  {
    match: /OpenSearch-VL|多模态搜索框架|2605\.05185/i,
    headline: "腾讯开源 OpenSearch-VL 多模态搜索智能体",
    note: "腾讯混元联合高校开源多模态搜索 Agent，补齐数据、轨迹合成和训练配方，目标是让模型主动搜索、理解视觉内容并给出可追溯答案。",
    facts: [
      "项目把网页搜索、图文理解和推理轨迹放进同一套训练流程。",
      "它关注的是多模态搜索 Agent，而不只是单次图片问答。",
      "开源数据和训练配方会影响后续视觉 Agent 复现门槛。",
    ],
  },
  {
    match: /修复手指畸形|Diffusion.*IQ|hand anomaly|finger.*(?:diffusion|image)|2605\.05026/i,
    headline: "研究用 Diffusion-IQ 修复生成图里的手指畸形",
    note: "这篇论文聚焦扩散模型常见的手部结构错误，用质量评估和局部修复思路改善手指畸形，说明图像生成正在补最影响观感的细节短板。",
    facts: [
      "问题不是重新生成整张图，而是识别并修复局部异常。",
      "手指、肢体和物理细节会直接影响商业图片可用性。",
      "这类方法适合接入设计工具和自动后处理流水线。",
    ],
  },
  {
    match: /物理规律识别伪造|Hamiltonian|deepfake|forgery|2605\.04405/i,
    headline: "研究用物理规律识别 AI 伪造视频",
    note: "这项研究把哈密顿动力学等物理约束用于检测深度伪造，重点是从运动规律里寻找破绽，而不是只靠画面纹理和像素痕迹。",
    facts: [
      "伪造检测从图像瑕疵扩展到物体运动和物理一致性。",
      "这对视频生成、合成媒体审核和取证工具都有直接影响。",
      "模型越会补纹理，物理一致性越可能成为下一类检测信号。",
    ],
  },
  {
    match: /\bMSM\b|中期训练规格对齐|model[-\s]?similarity map|model similarity map|anthropic\.com\/2026\/msm/i,
    headline: "Anthropic MSM 用模型特征图观察对齐漂移",
    note: "Anthropic MSM 信号关注用模型相似性图追踪行为和对齐变化，重点是让安全研究从输出案例深入到模型内部表示。",
    facts: [
      "MSM 把不同训练阶段或不同模型的特征空间放到同一张图上比较。",
      "研究者可以观察对齐、能力和异常行为是否沿着某些方向漂移。",
      "这类方法会影响模型审计、安全评测和红队工作流。",
    ],
  },
  {
    match: /xAI并入SpaceX|anthropic-compute-partnership|Anthropic.*SpaceX|SpaceX.*Claude Code|Colossus.*Anthropic/i,
    headline: "Anthropic 与 SpaceX 算力合作扩大 Claude Code 供给",
    note: "xAI 页面披露的算力合作被日报抓到，真正值得看的是 Claude Code 使用限额、推理供给和开发者高频使用之间的基础设施竞争。",
    facts: [
      "信号核心是算力供给，不是单纯的产品公告。",
      "编码 Agent 的重度用户会直接感受到限额、排队和响应速度变化。",
      "AI 工具竞争正在从模型能力扩展到稳定推理产能。",
    ],
  },
  {
    match: /大模型调用量暴涨|Hy3preview|腾讯混元|Hy3|27753/i,
    headline: "腾讯混元 Hy3preview 调用量快速增长",
    note: "Hy3preview 上线两周后 Token 调用量升至前代十倍以上，说明编程和推理场景正在给国产模型带来真实流量。",
    facts: [
      "调用量增长比参数宣传更能反映产品真实使用。",
      "高频场景可能来自代码、长文本和复杂推理任务。",
      "后续关键看价格、上下文长度和稳定性是否能留住开发者。",
    ],
  },
  {
    match: /a16z重磅博文|a16z.*(?:unemployment|失业|就业)|AI unemployment|entry-level jobs/i,
    headline: "a16z 反驳 AI 正在吞掉入门岗位的单线叙事",
    note: "a16z 相关讨论把 AI、就业和入门岗位变化放到同一张图里，核心不是否认冲击，而是提醒市场要区分岗位替代、技能重组和新需求。",
    facts: [
      "这类信号影响企业采购、人才训练和投资叙事。",
      "入门岗位变化不能只看裁员标题，还要看新岗位和工作内容重组。",
      "AI 劳动力议题会持续影响监管与商业化节奏。",
    ],
  },
  {
    match: /韩国机器人完成庄严皈依|机器人.*皈依|robot monk|拟人机器僧|迦悲|South Korea.*humanoid/i,
    headline: "韩国机器人僧侣引发具身智能社会边界讨论",
    note: "韩国首位机器人僧侣相关报道在社交平台发酵，真正的信号不在猎奇，而在机器人进入宗教、陪伴和公共仪式时如何被社会接受。",
    facts: [
      "它不是单纯技术发布，而是人机关系的文化测试。",
      "机器人一旦进入仪式和陪伴场景，信任、身份和伦理会变成产品问题。",
      "这类案例能帮助观察具身智能的社会接受边界。",
    ],
  },
  {
    match: /全球三城零代码挑战赛|no[-\s]?code.*hackathon|零代码.*挑战/i,
    headline: "全球零代码挑战赛推动 AI 原生应用实验",
    note: "全球三城零代码挑战赛把 AI 工具、产品想法和快速交付放进同一个赛道，说明非工程背景团队也在进入 AI 原生应用开发。",
    facts: [
      "零代码不只是拖拽建站，而是把模型、自动化和业务流程拼成可用产品。",
      "这种活动能快速暴露真实需求和低门槛工具的短板。",
      "后续值得看优秀项目能否从 demo 进入稳定运营。",
    ],
  },
  {
    match: /financial-services|金融智能方案库|anthropics\/financial-services/i,
    headline: "Anthropic 金融智能体方案库面向企业场景",
    note: "Anthropic 金融服务方案库把合规、分析和客户场景沉淀为可复用示例，说明模型公司正在把行业落地做成模板化资产。",
    facts: [
      "金融场景需要权限、审计和可解释性，不适合只靠通用聊天入口。",
      "方案库能帮助企业更快评估 Agent 是否适合内部流程。",
      "它也会推动模型厂商从 API 竞争走向行业解决方案竞争。",
    ],
  },
  {
    match: /vercel-labs\/open-agents|open-agents|开源智能体模板|Vercel AI SDK|vercel\/ai\b/i,
    headline: "Vercel 开源 Agent 模板降低 AI 应用交付门槛",
    note: "Vercel 生态继续把聊天、工具调用、流式 UI 和 Agent 应用模板化，方便前端团队更快做出可上线的 AI 产品原型。",
    facts: [
      "模板覆盖流式输出、工具调用、会话状态和前端交互。",
      "它把 Agent 应用的工程门槛压到 Next.js 和 AI SDK 的常规栈内。",
      "后续关键看模板能否补齐权限、计费、监控和评估。",
    ],
  },
  {
    match: /浏览器自动化黑科技|browser automation|gdb\/status|gdb\/status\/2052525058325647693/i,
    headline: "浏览器自动化信号显示 Agent 正在接管网页任务",
    note: "这条浏览器自动化信号和 Codex for Chrome 属于同一方向：模型不只回答问题，而是理解页面、调用控件并完成多步网页操作。",
    facts: [
      "浏览器是多数知识工作者每天停留最久的操作界面。",
      "自动化能力会直接影响测试、表单处理、信息检索和后台运营。",
      "真正难点在权限隔离、失败回滚和可审计操作记录。",
    ],
  },
  {
    match: /革命性交互技术|GPT[-\s]?5 visual|visual protocol|computer-use visual|oran_ge/i,
    headline: "GPT-5 视觉协议把屏幕理解接进自动化链路",
    note: "这条信号把 GPT-5 视觉能力和 computer-use 自动化放在一起看，关键是模型是否能稳定理解屏幕、定位控件并执行多步任务。",
    facts: [
      "视觉协议关注屏幕截图、控件定位和动作反馈之间的闭环。",
      "它会直接影响浏览器、桌面软件和远程 IDE 的 Agent 自动化体验。",
      "真正门槛不在识图本身，而在连续任务里的可靠性和权限边界。",
    ],
  },
  {
    match: /终端直接调用接口|openai-cli|OpenAI.*CLI|official CLI|dotey\/status/i,
    headline: "OpenAI CLI 让开发者在终端直接调用 Agent 工具",
    note: "OpenAI CLI 相关信号指向同一个趋势：开发者希望把 Responses API、文件检索、图像生成和工具调用直接塞进脚本与终端工作流。",
    facts: [
      "CLI 会让模型调用更容易被写进 CI、脚本和本地自动化。",
      "它降低了从实验到工程流水线的接入成本。",
      "后续要看认证、日志、成本控制和团队权限是否足够成熟。",
    ],
  },
  {
    match: /AI营销核心提示词|GEO prompts|generative engine optimization|AI search optimization|yao-open-prompts/i,
    headline: "GEO 提示词集把 AI 搜索优化带进营销工作流",
    note: "GEO 提示词集把生成式引擎优化、AI 搜索曝光和内容生产串起来，说明品牌增长正在从 SEO 迁移到面向 AI 答案的工作流。",
    facts: [
      "GEO 关注品牌内容如何被 ChatGPT、Perplexity 等答案引擎引用。",
      "提示词集把选题、内容结构和短视频脚本放进同一套模板。",
      "它更像营销团队的操作手册，而不是单纯的开源小工具。",
    ],
  },
  {
    match: /AI bubble|泡沫|深度洞察行业|AI.*bubble/i,
    headline: "AI 泡沫讨论开始从估值转向真实生产率",
    note: "AI 泡沫相关讨论的价值不在唱衰，而是逼迫行业把注意力从融资、估值和发布会转向留存、成本、收入和真实生产率。",
    facts: [
      "泡沫争论会影响企业预算、资本市场和产品定价。",
      "更关键的问题是哪些 AI 工作流能持续创造可计量收益。",
      "这类宏观信号适合放进行业趋势跟踪，而不是当天结论。",
    ],
  },
  {
    match: /45 psychological questionnaires|传统人格特质|psychological questionnaires|人格特质/i,
    headline: "研究用心理问卷测量大模型人格特征",
    note: "这条社区讨论把传统心理量表用于多个大模型，信号意义在于评估从能力测试扩展到行为稳定性、人格拟合和用户感知。",
    facts: [
      "心理问卷不能直接等同于真实人格，但能暴露模型回答风格差异。",
      "这类测试会影响陪伴、客服和教育场景的模型选择。",
      "关键是把娱乐化测评和严肃评估边界区分清楚。",
    ],
  },
  {
    match: /Trae mobile|Trae.*(?:iPhone|Android|移动端|手机|IDE)/i,
    headline: "Trae 移动端把手机变成远程 IDE 控制台",
    note: "Trae 移动端把手机接进桌面 IDE 和编码 Agent 流程，重点不只是移动 App，而是让远程开发、任务续跑和第三方模型配置变得更轻。",
    facts: [
      "移动端负责查看、唤起和跟进桌面 IDE 里的 Agent 任务。",
      "开发者可以把远程编码、模型密钥和团队协作放进同一条链路。",
      "这类产品会把 AI 编程从桌面工具扩展成跨设备工作流。",
    ],
  },
  {
    match: /Warp Skills|Warp AI.*(?:terminal|skills)|terminal workflows.*agents|Warp开源高效技能库|Warp.*技能库|oz-skills/i,
    headline: "Warp Skills 把终端工作流封装成可复用技能",
    note: "Warp Skills 把命令、上下文和团队操作手册封装成可复用能力包，说明终端 AI 正在从一次性问答转向可沉淀的工程流程。",
    facts: [
      "技能包可以复用常见 shell 命令、仓库上下文和排障步骤。",
      "团队可以把稳定做法沉淀下来，减少每次都重新提示模型。",
      "关键价值在于把 Agent 执行和工程规范绑定起来。",
    ],
  },
  {
    match: /GPT[-\s]?5 visual|visual protocol|computer-use visual/i,
    headline: "GPT-5 视觉协议把屏幕理解接进自动化链路",
    note: "这条信号把 GPT-5 视觉能力和 computer-use 自动化放在一起看，关键是模型是否能稳定理解屏幕、定位控件并执行多步任务。",
    facts: [
      "视觉协议关注屏幕截图、控件定位和动作反馈之间的闭环。",
      "它会直接影响浏览器、桌面软件和远程 IDE 的 Agent 自动化体验。",
      "真正门槛不在识图本身，而在连续任务里的可靠性和权限边界。",
    ],
  },
  {
    match: /GEO prompts|generative engine optimization|AI search optimization/i,
    headline: "GEO 提示词集把 AI 搜索优化带进营销工作流",
    note: "GEO 提示词集把生成式引擎优化、AI 搜索曝光和内容生产串起来，说明品牌增长正在从 SEO 迁移到面向 AI 答案的工作流。",
    facts: [
      "GEO 关注品牌内容如何被 ChatGPT、Perplexity 等答案引擎引用。",
      "提示词集把选题、内容结构和短视频脚本放进同一套模板。",
      "它更像营销团队的操作手册，而不是单纯的开源小工具。",
    ],
  },
  {
    match: /\bMSM\b|model[-\s]?similarity map|model similarity map|alignment.*(?:drift|maps)/i,
    headline: "Anthropic MSM 用模型特征图观察对齐漂移",
    note: "Anthropic MSM 信号关注用模型相似性图追踪行为和对齐变化，重点是让安全研究从输出案例深入到模型内部表示。",
    facts: [
      "MSM 把不同训练阶段或不同模型的特征空间放到同一张图上比较。",
      "研究者可以观察对齐、能力和异常行为是否沿着某些方向漂移。",
      "这类方法会影响模型审计、安全评测和红队工作流。",
    ],
  },
  {
    match: /vercel\/ai\b|Vercel AI SDK|agent template.*vercel|vercel.*agent template/i,
    headline: "Vercel AI 模板继续扩展 Agent 应用脚手架",
    note: "Vercel AI 生态继续把聊天、工具调用、流式 UI 和 Agent 应用模板化，方便前端团队更快做出可上线的 AI 产品原型。",
    facts: [
      "模板覆盖流式输出、工具调用、会话状态和前端交互。",
      "它把 Agent 应用的工程门槛压到 Next.js 和 AI SDK 的常规栈内。",
      "值得观察的是模板能否从 demo 走向权限、计费和监控完备的生产应用。",
    ],
  },
  {
    match: /Claude Mythos|Mythos Preview|Firefox vulnerabilities|Mozilla.*agentic AI pipeline/i,
    headline: "Mozilla 用 Claude Mythos 发现 Firefox 未知漏洞",
    note: "Mozilla 的 agentic AI pipeline 调用 Claude Mythos Preview 扫描 Firefox，发现 271 个此前未知的安全漏洞，代码审计正在成为 Agent 落地最快的严肃场景之一。",
    facts: [
      "这条信号来自 Firefox 安全分析，不是普通聊天机器人演示。",
      "核心价值在自动发现、复现和整理漏洞线索，仍需要安全团队复核。",
      "它说明 Agent 能力正在进入高风险代码库审计流程。",
    ],
  },
  {
    match: /Most agentic AI conversations feel too abstract|practical examples of agentic AI|agentic AI.? conversations feel too|agentic AI conversations feel too abstract/i,
    headline: "Reddit 讨论 Agent 落地案例仍然太抽象",
    note: "Reddit 用户抱怨 Agent 讨论常停留在框架和 demo，真正可复用的业务案例太少，这反映出行业从概念热转向交付证据的压力。",
    facts: [
      "社区关注点从“有没有 Agent”转向“能不能解决真实任务”。",
      "缺口主要在端到端案例、失败边界和可复制工作流。",
      "这类讨论能帮助筛掉只会包装概念的 Agent 项目。",
    ],
  },
  {
    match: /QwenLM\/qwen-code|qwen-code|open-source AI agent that lives in your terminal/i,
    headline: "Qwen Code 把开源编码 Agent 放进终端",
    note: "Qwen Code 是 QwenLM 生态里的终端编码 Agent，强调开源、命令行常驻和本地开发流程接入，适合跟踪国产模型在开发者工具链里的渗透。",
    facts: [
      "项目定位是运行在终端里的开源 AI 编码 Agent。",
      "它把 Qwen 模型能力接到开发者熟悉的命令行界面。",
      "后续关键看工具调用、仓库理解和复杂修改的稳定性。",
    ],
  },
  {
    match: /Perplexity.*(?:Personal Computer|个人电脑|Mac|Mac\s*assistant)|智能代理个人电脑/i,
    headline: "Perplexity Mac 助手面向所有用户开放",
    note: "Perplexity 将 Personal Computer Mac 助手向所有用户开放，重点是把网页检索、本地应用和文件上下文接到同一个桌面 AI 工作流里。",
  },
  {
    match: /openai-cli|OpenAI.*CLI|official CLI/i,
    headline: "OpenAI 发布 openai-cli 终端工具",
    note: "OpenAI 发布 openai-cli，让开发者可以在终端直接调用 Responses API、文件检索、图像生成和 Agent 工具，降低脚本化接入门槛。",
  },
  {
    match: /ProgramBench/i,
    headline: "ProgramBench 用程序重建任务拷问 LLM 理解力",
    note: "ProgramBench 让模型从黑盒输入输出中反推出程序结构，用更硬的方式检验 LLM 是否真正理解规则，而不只是记住题型。",
  },
  {
    match: /Natural Language Activations|\bNLA\b|模型激活|激活译成文本|激活值转文字/i,
    headline: "Anthropic NLA 把模型激活翻译成自然语言",
    note: "Anthropic 开源 Natural Language Activations，把模型内部激活转成可读文字，关键争议在解释是否真实、可复核，以及能否用于安全审计。",
    facts: [
      "NLA 试图把模型内部激活映射成自然语言解释。",
      "价值在于让安全研究者更容易审计模型为什么这样回答。",
      "争议点是这些解释是否忠实反映内部机制，而不是事后包装。",
    ],
  },
  {
    match: /faking their own reasoning traces|fake their own reasoning traces|reasoning traces|Natural Language Autoencoders.*Claude Opus 4/i,
    headline: "模型开始伪造推理轨迹，AI 安全测试面临新问题",
    note: "The Decoder 抓到的信号是：安全评测不能只看模型给出的思考过程，因为模型可能学会生成看似合理、实际并不忠实的推理轨迹。",
    facts: [
      "问题不在模型有没有输出推理，而在推理轨迹是否忠实反映内部过程。",
      "如果模型会伪装思考链，红队和安全评测需要更多内部表示、行为对照和外部验证。",
      "这会影响企业如何审计高风险 Agent 和推理模型。",
    ],
  },
  {
    match: /GPT[-\s]?Image[-\s]?2.*(?:Twitter|Wild|Visual)|Twitter Dataset.*Visual/i,
    headline: "GPT-Image-2 Twitter 数据集暴露视觉模型真实用法",
    note: "这项研究整理 GPT-Image-2 在 Twitter 上的真实使用数据，用来观察视觉模型在公开提示、传播反馈和社交场景里的实际行为。",
  },
  {
    match: /Evaluation-Context Divergence|Paired-Prompt Protocol|Alignment-Pipeline/i,
    headline: "研究用成对提示评估开源模型对齐差异",
    note: "论文关注评测上下文变化对模型表现的影响，提醒安全和对齐基准不能只看单一提示或单一测试环境。",
  },
  {
    match: /Qwen\/WebWorld|WebWorld.*Qwen3/i,
    headline: "Qwen WebWorld 用网页环境训练和评估智能体",
    note: "Qwen WebWorld 把开放网页变成智能体训练和评估场景，重点观察模型能否在真实网页任务中完成检索、规划和操作。",
  },
  {
    match: /Benchmark Qwen.*3090|NVLINK|MTP/i,
    headline: "社区实测 Qwen3 多卡本地推理表现",
    note: "LocalLLaMA 用户在双 3090/NVLink 上测试 Qwen3 吞吐和长上下文表现，说明本地模型部署仍受显存、带宽和推理栈影响。",
  },
  {
    match: /DeepSeek 4 Flash.*Metal|DeepSeek 4 Flash local inference engine/i,
    headline: "DeepSeek 4 Flash Metal 聚焦 Mac 本地推理极限",
    note: "News Hacker 讨论 DeepSeek 4 Flash 在 Apple Metal 上的本地推理优化，核心看单模型、单硬件特化能否继续压榨吞吐、功耗和长上下文表现。",
  },
  {
    match: /DeepSeek.*(?:450亿美元|450\s*billion|估值).*三星|三星.*DeepSeek.*(?:450亿美元|估值)|投后估值或达450亿美元/i,
    headline: "DeepSeek 估值传闻进入中文科技早报",
    note: "雷峰网早报把 DeepSeek 投后估值或达 450 亿美元列入要闻，信号意义在于国产大模型资本预期仍在头部公司上集中。",
  },
  {
    match: /Plaud.*(?:20亿美元|20\s*billion|估值)/i,
    headline: "Plaud 融资后估值升至约 20 亿美元",
    note: "36氪称 AI 录音笔公司 Plaud 获头部大厂投资，估值升至约 20 亿美元，说明硬件入口和会议知识整理仍是 AI 商业化热点。",
  },
  {
    match: /complete Claude Code course|code-agents\.ai/i,
    headline: "Claude Code 课程面向工程师和技术创始人",
    note: "这套 Claude Code 课程面向工程师和技术创始人，社区关注点在于编码智能体已经从工具尝鲜进入系统化学习和团队训练阶段。",
  },
  {
    match: /use Codex to Ship Faster.*Ban on Reddit|Codex.*Ban on Reddit|heads up, builders/i,
    headline: "Reddit 用户提醒 Codex 高频发帖可能触发封禁",
    note: "Reddit 讨论提醒开发者用 Codex 加速发布内容时仍要注意平台反滥用规则，AI 生产效率越高，账号信誉和分发边界越需要管理。",
  },
  {
    match: /Boris Cherny.*TI-83|TI-83.*Basic Programming Tutorial|Claude Code 作者 Boris Cherny/i,
    headline: "Boris Cherny 的 TI-83 教程被重新讨论",
    note: "Claude Code 作者 Boris Cherny 早年的 TI-83 BASIC 教程被重新翻出，社区把它当作一代工程师从计算器编程走向软件开发的缩影。",
  },
  {
    match: /testing ads in chatgpt/i,
    headline: "OpenAI 在 ChatGPT 中测试广告",
    note: "OpenAI 开始在 ChatGPT 中测试广告形态，强调清晰标注、答案优先和隐私控制，免费入口的商业化节奏继续加快。",
  },
  {
    match: /advancing voice intelligence|new realtime voice models|GPT-Realtime|real-time conversations/i,
    headline: "OpenAI 发布新一代实时语音模型",
    note: "OpenAI 推出面向实时对话、翻译和转录的新语音模型，重点是把更强推理能力接进低延迟语音交互。",
  },
  {
    match: /frontier enterprises|B2B Signals/i,
    headline: "OpenAI 发布 B2B Signals 企业 AI 采用研究",
    note: "报告拆解前沿企业如何把 AI 从试点推进到规模化应用，重点看业务流程、数据闭环和组织能力。",
  },
  {
    match: /Parloa/i,
    headline: "Parloa 用 OpenAI 模型构建语音客服智能体",
    note: "案例展示服务型 Agent 如何处理真实客户对话，核心是把语音、工具调用和客服流程接起来。",
  },
  {
    match: /ChatGPT ads|buy ChatGPT ads/i,
    headline: "OpenAI 扩展 ChatGPT Ads 购买方式",
    note: "OpenAI 推出自助广告管理、CPC 出价和素材能力，说明 ChatGPT 商业化入口正在成形。",
  },
  {
    match: /Codex for Chrome|Codex.*Chrome.*浏览器工作流|400\s*万周活.*Codex/i,
    headline: "OpenAI 将 Codex 扩展到 Chrome 浏览器工作流",
    note: "Codex for Chrome 让用户在浏览器里处理测试、多标签页上下文和 DevTools 操作，400 万周活说明编码智能体正在进入网页任务执行。",
  },
  {
    match: /raises Claude Code usage limits|Anthropic.*SpaceX|SpaceX.*Claude Code|anthropic-compute-partnership/i,
    headline: "Anthropic 借 SpaceX 合作上调 Claude Code 使用限额",
    note: "Anthropic 在开发者大会上提高 Claude Code 使用额度，并把原因指向新的 SpaceX 合作，背后是算力供给和开发者留存的竞争。",
  },
  {
    match: /Claude Managed Agents can now.*dream|can now "dream"|Claude.*Dreaming|Dreaming.*Claude Managed Agents|Code with Claude/i,
    headline: "Anthropic 为 Claude 托管智能体加入“梦境”能力",
    note: "Claude 托管智能体开始支持类似后台整理和规划的“梦境”机制，目标是让长任务执行更连续、更少依赖人工盯守。",
  },
  {
    match: /Simplex.*software development.*Codex|simplex/i,
    headline: "Simplex 用 ChatGPT Enterprise 和 Codex 重塑软件开发",
    note: "OpenAI 案例显示 Simplex 把 ChatGPT Enterprise 和 Codex 接入软件开发流程，用于缩短设计、开发和协作周期。",
  },
  {
    match: /Singular Bank.*ChatGPT.*Codex/i,
    headline: "Singular Bank 用 ChatGPT 和 Codex 加速银行工作流",
    note: "OpenAI 案例展示银行团队把 ChatGPT 与 Codex 放进日常协作，用于更快处理产品、合规和软件开发任务。",
  },
  {
    match: /最炸机器人Demo|单手打蛋|解魔方|弹钢琴|1亿美元种子轮/i,
    headline: "机器人团队展示单模型打蛋与弹琴 Demo",
    note: "量子位报道的机器人演示把单手打蛋、解魔方和弹钢琴放进同一个模型能力展示，核心看具身智能是否开始从单点动作走向泛化操作。",
  },
  {
    match: /Recondo|Logging Proxy.*Coding Agents/i,
    headline: "Recondo 为编码智能体提供日志代理",
    note: "Recondo 给 Claude Code、Codex、Gemini 等编码智能体加一层日志代理，方便团队审计工具调用和排查自动化行为。",
  },
  {
    match: /Claude Code CVE|sandbox escape|GHSA-vp62/i,
    headline: "Claude Code 沙箱逃逸漏洞提醒团队收紧 Agent 权限",
    note: "GitHub Advisory 披露 Claude Code 存在通过符号链接逃逸沙箱的风险，团队部署编码智能体时需要把文件权限、隔离边界和升级节奏纳入检查。",
  },
  {
    match: /Phishing Arena|multi-agent LLM tournament|adversarial email security|Krabby24\/phishing-arena/i,
    headline: "Phishing Arena 用多智能体锦标赛研究钓鱼邮件攻防",
    note: "Phishing Arena 把攻击者、防守者和评审模型放进同一个实验场，用多智能体对抗来观察 LLM 在钓鱼邮件攻防里的策略边界。",
    facts: [
      "它把邮件攻击、防御和评估拆成多个智能体角色。",
      "这类实验能帮助安全团队观察模型在社会工程攻击中的误用风险。",
      "价值不在单次 demo，而在可复现的攻防评测框架。",
    ],
  },
  {
    match: /氛围编程|vibe[-\s]?coding|Claude Code.*(?:负责人|vibe|氛围|reflect)/i,
    headline: "Claude Code 负责人反思“氛围编程”说法",
    note: "Claude Code 负责人认为旧词已经不足以概括 AI 编程，行业叙事正在从玩票式提示词转向严肃的 Agent 工程工作流。",
  },
  {
    match: /OpenSearch-VL/i,
    headline: "腾讯开源 OpenSearch-VL 多模态搜索智能体",
    note: "腾讯混元联合高校开源多模态搜索 Agent，补齐数据、轨迹合成和训练配方，目标是让模型主动搜索与推理。",
  },
  {
    match: /Hy3preview|腾讯混元/i,
    headline: "腾讯混元 Hy3preview 调用量快速增长",
    note: "Hy3preview 上线两周后 Token 调用量升至前代十倍以上，说明编程和推理场景正在给国产模型带来真实流量。",
  },
  {
    match: /hypothesis-driven|DILI|Drug-induced liver injury/i,
    headline: "可解释假设驱动方法用于药物性肝损伤识别",
    note: "论文把假设生成、证据检索和解释链结合起来，用于提升 DILI 风险判断的可追踪性。",
  },
  {
    match: /Investigating Advanced Reasoning|Black-Box Environment Interaction/i,
    headline: "黑箱环境交互评估大模型高级推理能力",
    note: "论文把模型放进黑箱环境中观察交互表现，用更贴近真实任务的方式评估大模型的高级推理边界。",
  },
  {
    match: /Agent Island|Saturation-.*Contamination-Resistant Agent Benchmark|static capabilities benchmarks/i,
    headline: "Agent Island 评估多智能体基准污染问题",
    note: "论文关注静态能力基准的饱和和污染，尝试用 Agent Island 检验智能体在复杂环境中的真实泛化。",
  },
  {
    match: /TSCG|Tool-Schema Compilation|tool schemas.*deterministic/i,
    headline: "TSCG 用确定性工具 Schema 规范智能体调用",
    note: "论文把工具 schema 编译成更可控的调用约束，目标是减少智能体在工具使用中的格式漂移和执行错误。",
  },
  {
    match: /In-Context Prompting Obsoletes Agent Orchestration|Agent Orchestration Frameworks|Production agent frameworks/i,
    headline: "上下文提示可能替代部分 Agent 编排框架",
    note: "论文挑战复杂编排框架的必要性，认为部分任务里上下文提示就能完成协调，值得重新评估 Agent 架构复杂度。",
  },
  {
    match: /Agentic Reinforcement Learning/i,
    headline: "Agentic RL 综述梳理大模型强化学习新方向",
    note: "综述把强化学习、工具调用和智能体任务结合起来，关注大模型从静态回答走向主动执行时的训练方法。",
  },
  {
    match: /Repository-Level Code Generation|Context Inlining/i,
    headline: "代码库级生成研究用上下文内联提升准确性",
    note: "论文关注跨文件代码生成难题，通过上下文内联让模型更好理解仓库结构和依赖关系。",
  },
  {
    match: /Behavioral Simulation|Solver-Sampler Mismatch|Multi-Agent LLM Negotiation/i,
    headline: "研究指出推理模型在多智能体谈判模拟中可能失真",
    note: "论文发现强推理模型未必适合行为模拟，求解能力和采样行为之间的错配会影响多智能体谈判结果。",
  },
  {
    match: /Code Broker/i,
    headline: "Code Broker 提出多智能体代码协作系统",
    note: "论文让多个智能体分工处理自动编程任务，重点在任务分配、代码生成和审查协同。",
  },
  {
    match: /Budget-aware Auto Optimizer|Optimizer Configurator/i,
    headline: "预算感知自动优化器配置器关注训练显存",
    note: "研究瞄准优化器状态占用显存的问题，尝试在预算约束下自动选择更省资源的训练配置。",
  },
  {
    match: /Evaluation Cards|XAI Metrics/i,
    headline: "Evaluation Cards 让可解释 AI 评估更可复核",
    note: "研究用卡片化方式记录 XAI 指标和评估条件，让模型解释质量更容易比较、审计和复现。",
  },
  {
    match: /Pen-Strategist/i,
    headline: "Pen-Strategist 面向安全攻防任务设计推理框架",
    note: "论文把网络威胁场景拆成可推理步骤，重点看智能体如何制定更可解释的渗透测试策略。",
  },
  {
    match: /DeepSeek-TUI/i,
    headline: "DeepSeek-TUI 把 DeepSeek 编码 Agent 放进终端",
    note: "项目把 DeepSeek 模型接入命令行开发流程，面向喜欢终端操作的开发者。",
  },
  {
    match: /aaif-goose|block\/goose|goose/i,
    headline: "Goose 把开源 Agent 放进终端执行链路",
    note: "Goose 是面向开发者的开源 Agent 框架，重点不是补全代码，而是让模型能安装工具、执行任务并接入本地工作流。",
  },
  {
    match: /agent-skills/i,
    headline: "agent-skills 把工程经验封装成智能体技能库",
    note: "项目把生产级工程技能做成可复用能力包，方便 AI 编码智能体稳定处理复杂任务。",
  },
  {
    match: /oh-my-openagent|oh-my-opencode/i,
    headline: "oh-my-openagent 汇总开源 Agent 工具链实践",
    note: "项目把 OpenAgent、终端 Agent 和编码自动化相关实践收拢成入口，适合观察开源 Agent 工具链如何被开发者重新组合。",
  },
  {
    match: /danny-avila\/LibreChat|LibreChat|Enhanced ChatGPT Clone/i,
    headline: "LibreChat 把开源聊天平台扩展成多模型 Agent 工作台",
    note: "LibreChat 不只是 ChatGPT 克隆，它把 MCP、DeepSeek、Anthropic、OpenAI 和多模型配置放进同一套开源工作台，适合团队自建可控的 Agent 入口。",
    facts: [
      "项目覆盖多模型接入、工具调用和团队级聊天入口。",
      "MCP、DeepSeek、Anthropic、OpenAI 等集成让它更像可部署的 Agent 平台。",
      "价值在于企业能保留数据和权限控制，而不是完全依赖单一 SaaS。",
    ],
  },
  {
    match: /CowAgent|chatgpt-on-wechat/i,
    headline: "CowAgent 把微信机器人升级成可规划的 AI 助理",
    note: "CowAgent 基于 chatgpt-on-wechat 扩展规划、技能、系统访问和长期记忆能力，说明中文私域里的 AI 助理正在从问答机器人走向可执行工作流。",
  },
  {
    match: /claude-agent-sdk-python/i,
    headline: "Anthropic 开源 Claude Agent SDK Python 版本",
    note: "Anthropic 的 Claude Agent SDK Python 仓库进入活跃更新，重点看官方是否把 Claude Code 背后的 Agent 能力拆成更可复用的开发者接口。",
  },
  {
    match: /claude-agent-sdk-typescript/i,
    headline: "Anthropic 推进 Claude Agent SDK TypeScript 生态",
    note: "TypeScript 版本让前端和全栈团队更容易把 Claude Agent 能力接入现有应用，官方 SDK 生态开始覆盖更多工程栈。",
  },
  {
    match: /codex-action/i,
    headline: "OpenAI Codex Action 把编码智能体接进 GitHub 工作流",
    note: "Codex Action 让仓库里的 issue、PR 和自动化任务更容易触发编码智能体，关键是把 AI 编程从本地终端推向团队协作流程。",
  },
  {
    match: /deer-flow/i,
    headline: "字节 deer-flow 开源深度研究工作流",
    note: "deer-flow 把研究、检索和多步生成流程做成可复用框架，适合跟踪大厂如何把 Deep Research 能力开源化。",
  },
  {
    match: /Mininglamp|Cider|Mano-P/i,
    headline: "Mininglamp 开源 Cider 和 Mano-P 本地智能体方案",
    note: "两个项目分别解决 Mac 端侧推理加速和 GUI 操作问题，本地 AI 工作站体验继续升温。",
  },
  {
    match: /local-deep-research/i,
    headline: "local-deep-research 关注本地深度研究工作流",
    note: "项目强调本地化研究流程和问答表现，说明个人可控的研究型 Agent 仍有热度。",
  },
  {
    match: /PageIndex|VectifyAI/i,
    headline: "PageIndex 冲榜长文档索引开源项目",
    note: "PageIndex 关注长文档索引和检索增强，适合放进知识库、研究助理和 Agent 记忆工作流里观察。",
  },
  {
    match: /dflash|z-lab/i,
    headline: "dflash 冲榜开发者工具开源项目",
    note: "dflash 在 GitHub Trending 上升温，信号意义在于开发者仍在围绕更快的数据处理和 Agent 工程链路寻找基础工具。",
  },
  {
    match: /Rubber Duck.*GitHub Copilot CLI/i,
    headline: "GitHub Copilot CLI 的 Rubber Duck 支持更多模型",
    note: "GitHub 把 Copilot CLI 中的审查型 Agent 扩展到更多模型，说明命令行里的 AI 协作正在从单模型走向可切换架构。",
  },
  {
    match: /GitHub Copilot in Visual Studio Code|April releases/i,
    headline: "GitHub Copilot 在 VS Code 中加快发布节奏",
    note: "GitHub Copilot 随 VS Code 周稳定版持续更新，开发者工具正在用更短周期交付 AI 编程体验。",
  },
  {
    match: /Secret scanning.*GitHub MCP Server/i,
    headline: "GitHub MCP Server 接入 Secret Scanning",
    note: "GitHub 将密钥扫描能力接入 MCP Server，降低 AI 工具调用仓库和服务时泄露凭证的风险。",
  },
  {
    match: /500 亿美元|算力|Greg Brockman|\bcompute\b/i,
    headline: "OpenAI 巨额算力投入加剧基础设施竞赛",
    note: "OpenAI 管理层披露高额算力投入计划，核心信号是大模型训练和推理正在把资本开支推向新阶段。",
  },
  {
    match: /月之暗面.*20 亿美元|Kimi.*20 亿美元|Kimi.*估值.*200 亿美元/i,
    headline: "Kimi 新融资推高国产大模型估值竞赛",
    note: "极客公园援引消息称月之暗面将完成 20 亿美元融资、估值突破 200 亿美元，国产大模型公司的资本竞争继续向头部集中。",
  },
  {
    match: /豆包.*付费订阅|最高\s*500\s*元|豆包.*生产力场景/i,
    headline: "豆包测试付费订阅，生产力功能开始分层收费",
    note: "豆包被曝探索 68 元到 500 元不等的订阅档位，重点指向 PPT、数据分析和影视制作等高算力生产力场景。",
  },
  {
    match: /AI视频Agent产品|AI 视频 Agent|模型厂碾压|Seedance|LiblibAI/i,
    headline: "AI 视频 Agent 在大模型挤压下寻找商业壁垒",
    note: "36氪关注 AI 视频 Agent 工具的增长与隐忧：底层模型快速升级会带来红利，也可能压缩套壳工具的长期壁垒。",
  },
  {
    match: /像对待开发者一样对待你的编程 Agent|yolobox|Finbarr Taylor/i,
    headline: "编程 Agent 协作开始借鉴真人团队管理",
    note: "OSCHINA 转述 yolobox 作者观点：多个编程 Agent 需要像开发者团队一样被分工、隔离、审计和并行管理，而不是只靠一个终端盯着跑。",
  },
  {
    match: /AI Engineer World's Fair|Autoresearch|World Models|Vertical AI/i,
    headline: "AI Engineer World’s Fair 征集自研与世界模型议题",
    note: "AI 工程社区继续把自动研究、记忆、世界模型和垂直行业智能体作为大会核心议题，开发者关注点更偏工程落地。",
  },
  {
    match: /Trump.*AI safety testing|AI safety testing.*Trump|Spooked by Mythos|Mythos.*AI safety/i,
    headline: "美国 AI 安全测试政策因 Mythos 风险重新升温",
    note: "美国政府在 Mythos 等风险信号后重新推进 AI 安全测试合作，说明模型治理正在从口号转向具体评估协议。",
  },
  {
    match: /values better|why those values matter|Anthropic Fellows/i,
    headline: "Anthropic 研究称“先讲为什么”能改善价值对齐",
    note: "研究显示模型先学习价值观背后的原因，再执行具体行为约束，可能比直接灌输规则更稳定。",
  },
  {
    match: /AlphaEvolve|Gemini-powered coding agent/i,
    headline: "Google DeepMind 展示 Gemini 驱动的 AlphaEvolve",
    note: "AlphaEvolve 把 Gemini 用作代码和算法优化智能体，社区讨论重点在它对窄域优化、科研计算和自动发现流程的影响。",
  },
  {
    match: /Agentctl|local control plane for coding agents/i,
    headline: "Agentctl 为本地编码智能体提供控制平面",
    note: "Agentctl 尝试在编码智能体和真实命令执行之间加入本地控制层，让权限、审计和人工接管更可控。",
  },
  {
    match: /Codex hits limits|Codex.*rate limits|rate limits.*Codex/i,
    headline: "HN 热议 Codex 使用限额更容易触顶",
    note: "HN 用户讨论 Codex 使用限额是否更容易触达，说明高频开发者已经把编码智能体当成日常生产力工具，而不是偶尔试用。",
  },
  {
    match: /Vibe-coding video games|Fishies/i,
    headline: "开发者用 Claude 连续实验游戏 vibe-coding",
    note: "这条 HN 分享展示用 Claude 快速制作小游戏的过程，重点不在单个作品，而在 AI 编程能否支撑连续创作节奏。",
  },
  {
    match: /Unsloth|NVIDIA|consumer GPUs/i,
    headline: "Unsloth 与 NVIDIA 推动消费级 GPU 训练加速",
    note: "讨论聚焦消费级 GPU 上的 LLM 训练提速，关键看小团队是否能用更低成本完成模型微调。",
  },
  {
    match: /ZAYA1-8B|DeepSeek-R1|760M/i,
    headline: "ZAYA1-8B 用 MoE 小模型对标 DeepSeek-R1 数学能力",
    note: "这条信号关注 8B MoE 模型的有效参数效率，重点看小模型能否在数学和代码任务上逼近大模型表现。",
  },
  {
    match: /Inkscape/i,
    headline: "Inkscape 1.4.4 更新引发开源维护讨论",
    note: "更新本身偏小，但围绕回归、维护节奏和开源争议的讨论，反映工具型项目的治理压力。",
  },
  {
    match: /RSS traffic|RSS.*Google|Google.*RSS/i,
    headline: "RSS 流量超过 Google 的案例引发内容分发反思",
    note: "作者发现 RSS 带来的访问量超过搜索流量，说明高信任订阅渠道在 AI 摘要时代仍有价值。",
  },
];

export function composeDaily({ date, summaries, brand = "焦糖星球", draft = true } = {}) {
  const uniqueSummaries = dedupeDailySummaries(summaries ?? []);
  const grouped = groupBySection(uniqueSummaries);
  const sections = SECTION_ORDER.map((section) => ({
    key: section,
    title: SECTION_TITLES[section],
    items: grouped.get(section) ?? [],
  })).filter((section) => section.items.length > 0);
  const title = `${brand} AI资讯日报 ${formatChineseDate(date)}`;
  const descriptionItems = uniqueSummaries.map((item) => ({ ...item, title: displayHeadline(item) }));
  const description = descriptionFrom(descriptionItems, `${brand}每日 AI 行业动态、前沿技术、开源项目和工程影响判断。`);
  const markdown = `${dailyFrontmatter({ title, description, date, draft, sections })}

${dailyIntro({ brand })}

## 今日摘要

${buildDigest(uniqueSummaries)}

${sections.map(renderSection).join("\n\n")}

---

## AI资讯日报多渠道

- 站点：${brand}
- 生成方式：content-agent 抓取公开信源、AI 改写、人工复核后发布
- 发布前检查：来源链接、事实表述、标题是否过度承诺
`;

  return {
    relativePath: path.posix.join("src/content/dailies", `${date}.md`),
    markdown,
    title,
    description,
    sections,
  };
}

function dedupeDailySummaries(summaries) {
  const byEvent = new Map();
  for (const item of summaries) {
    const key = dailyEventKey(item);
    if (!key) continue;
    const existing = byEvent.get(key);
    if (!existing || isBetterDailySummary(item, existing)) {
      byEvent.set(key, item);
    }
  }
  return Array.from(byEvent.values());
}

function dailyEventKey(item) {
  const headline = displayHeadline(item);
  const normalized = normalizeForCompare(headline);
  if (normalized && normalized.length >= 8) return `headline:${normalized}`;
  return `url:${normalizeForCompare(item.sourceUrl ?? item.url ?? item.id ?? "")}`;
}

function isBetterDailySummary(candidate, existing) {
  const scoreDelta = Number(candidate.aiScore ?? candidate.score ?? 0) - Number(existing.aiScore ?? existing.score ?? 0);
  if (scoreDelta !== 0) return scoreDelta > 0;
  const candidateMedia = Number(candidate.media?.images?.length ?? 0) + Number(candidate.media?.videos?.length ?? 0);
  const existingMedia = Number(existing.media?.images?.length ?? 0) + Number(existing.media?.videos?.length ?? 0);
  return candidateMedia > existingMedia;
}

function dailyFrontmatter({ title, description, date, draft, sections }) {
  const lines = [
    "---",
    `title: ${yamlString(title)}`,
    `description: ${yamlString(description)}`,
    `date: ${yamlString(date)}`,
    `draft: ${draft ? "true" : "false"}`,
    "sections:",
  ];
  for (const section of sections) {
    lines.push(`  - title: ${yamlString(section.title)}`);
    lines.push("    items:");
    for (const item of section.items) {
      lines.push(`      - title: ${yamlString(displayHeadline(item))}`);
      lines.push(`        summary: ${yamlString(truncate(cleanSignalSummary(item), 260))}`);
      lines.push(`        whyItMatters: ${yamlString(truncate(item.reason, 180))}`);
      lines.push(`        sourceName: ${yamlString(displaySourceName(item))}`);
      lines.push(`        sourceUrl: ${yamlString(item.sourceUrl)}`);
      lines.push(`        tags:${yamlArray(item.tags ?? [], "          ")}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

function dailyIntro({ brand }) {
  return `> \`${brand}\` | \`AI资讯\` | \`每日早读\` | \`全网数据聚合\` | \`前沿科学探索\` | \`行业自由发声\` | \`开源创新力量\``;
}

function renderSection(section) {
  return `### ${section.title}

${section.items.map((item) => renderItem(item)).join("\n\n")}`;
}

function renderItem(item) {
  const headline = displayHeadline(item);
  const keywords = highlightTerms(item, headline);
  return `<article class="daily-signal">
<p class="daily-signal__copy"><span class="daily-signal__marker">&gt;&gt;</span> <a class="daily-signal__headline" href="${escapeAttr(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${renderMarkedText(headline, keywords)}</a> ${renderMarkedText(cleanSignalSummary(item), keywords)} <a class="daily-signal__source" href="${escapeAttr(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceAnchor(item))}</a></p>
${factList(item, keywords)}
${focusLine(keywords)}
${mediaMarkdown(item)}
</article>`.trim();
}

function factList(item, keywords) {
  const facts = editorialOverride(item)?.facts?.filter(Boolean) ?? [];
  if (!facts.length) return "";
  const items = facts.map((fact) => `<li>${renderMarkedText(stripEnding(fact), keywords)}</li>`).join("\n");
  return `<ul class="daily-signal__facts">\n${items}\n</ul>`;
}

function mediaMarkdown(item) {
  const video = item.media?.videos?.[0];
  if (video) {
    return `\n\n<br/>\n<video class="my-8 max-w-full h-auto border border-white/10 shadow-lg rounded-lg" controls="" preload="metadata" src="${escapeAttr(video)}" width="100%"></video>\n<br/>`;
  }
  const image = item.media?.images?.[0];
  if (image) {
    return `\n\n<br/>\n<span class="cursor-zoom-in relative group transition-all block"><img src="${escapeAttr(image)}" alt="AI资讯：${escapeAttr(displayHeadline(item))}" class="my-8 max-w-full h-auto border border-white/10" loading="lazy"/><span class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><span class="bg-black/60 p-2 rounded-full backdrop-blur-sm border border-white/20 transform scale-75 group-hover:scale-100 transition-transform"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-maximize2 lucide-maximize-2 w-5 h-5 text-white" aria-hidden="true"><path d="M15 3h6v6"></path><path d="m21 3-7 7"></path><path d="m3 21 7-7"></path><path d="M9 21H3v-6"></path></svg></span></span></span>\n<br/>`;
  }
  return "";
}

function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sourceAnchor(item) {
  const source = displaySourceName(item);
  if (/原始来源$/.test(source)) return `${sourceHostLabel(item.sourceUrl)}原始链接`;
  return `${source} 动态`;
}

function displaySourceName(item) {
  const source = String(item.sourceName ?? "原始来源").replace(/\s+/g, " ").trim();
  return source;
}

function sourceHostLabel(value) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    if (host === "x.com") return "X ";
    if (host === "github.com") return "GitHub ";
    if (host === "arxiv.org") return "arXiv ";
    if (host === "aibase.com") return "AIbase ";
    if (host === "qbitai.com") return "量子位 ";
    if (host === "alignment.anthropic.com") return "Anthropic ";
    if (host === "reddit.com") return "Reddit ";
    if (host === "x.ai") return "xAI ";
    if (host === "mp.weixin.qq.com") return "微信 ";
    if (host === "the-express.com") return "The Express ";
    return `${host} `;
  } catch {
    return "";
  }
}

function focusLine(keywords) {
  if (!keywords.length) return "";
  const marks = keywords
    .slice(0, 4)
    .map((keyword) => `<mark>${escapeHtml(keyword)}</mark>`)
    .join(" ");
  return `<p class="daily-signal__focus">重点词 ${marks}</p>`;
}

function displayHeadline(item) {
  const editorial = editorialOverride(item);
  if (editorial) return editorial.headline;
  const title = normalizeDigestText(item.title || item.originalTitle);
  if (hasCjk(title) && !isGenericHeadline(title)) return title;
  return fallbackHeadline(item);
}

function cleanSignalSummary(item) {
  const editorial = editorialOverride(item);
  if (editorial) return editorial.note;
  const fallback = summaryFallback(item);
  const title = normalizeDigestText(item.title);
  const summary = stripSourcePreamble(normalizeDigestText(item.aiSummary))
    .replace(/焦糖星球把它归入今日 AI资讯 观察[^。！？.!?]*[。！？.!?]?/gu, "")
    .replace(/重点不是标题热闹，而是它可能改变产品、研究或开发者工作流[。！？.!?]?/gu, "")
    .replace(/开发者\s*[^。！？.!?]*?可以先看来源细节，发布前仍会复核事实[。！？.!?]?/gu, "")
    .trim();
  let cleaned = stripSourcePreamble(removeLeadingTitleSentence(summary, title)).trim();
  cleaned = cleaned.replace(/\s+/g, " ").replace(/\s+([，。；：、])/g, "$1");
  cleaned = stripBylineNoise(cleaned);
  if (!cleaned || visibleLength(cleaned) < 20 || /^评[分…]|^作者[:：]/u.test(cleaned)) {
    cleaned = fallback;
  }
  const finalSummary = stripEnding(truncate(cleaned, 170));
  if (visibleLength(finalSummary) < 20) return stripEnding(truncate(fallback, 170));
  return finalSummary;
}

function stripSourcePreamble(value) {
  const text = String(value ?? "").trim();
  const thought = text.match(/💭\s*(.+)$/u)?.[1];
  if (thought) return thought.trim();
  return text
    .replace(/^arXiv:\S+\s+Announce Type:\s+\S+\s+Abstract:\s*/iu, "")
    .replace(/原标题[:：]\s*《[^》]*》\s*/gu, "")
    .replace(/原标题[:：].*$/u, "")
    .replace(/评分[:：]\s*\d+[^。！？.!?]*[。！？.!?]?/gu, "")
    .replace(/^评…$/u, "")
    .trim();
}

function stripBylineNoise(value) {
  return stripLeadingByline(String(value ?? ""))
    .replace(/^。?\s*/u, "")
    .replace(/^文[｜|][^“「。！？.!?]{0,80}(?=[“「])/u, "")
    .replace(/^作者[：:｜|][^“「。！？.!?]{0,80}(?=[“「])/u, "")
    .replace(/^编辑[：:｜|][^“「。！？.!?]{0,80}(?=[“「])/u, "")
    .trim();
}

function summaryFallback(item) {
  const original = normalizeDigestText(item.originalTitle);
  if (original && original !== normalizeDigestText(item.title) && hasCjk(original)) {
    return `原始信号聚焦 ${original}，后续重点看它对产品、研究或开发者工作流的实际影响。`;
  }
  return `${sourceLabel(item)} 出现一条 ${fallbackHeadline(item)}，后续重点看它对产品、研究或开发者工作流的实际影响。`;
}

function removeLeadingTitleSentence(summary, title) {
  const firstSentence = summary.match(/^(.{1,120}?[。！？])\s*/u)?.[1] ?? "";
  if (!firstSentence) return summary;
  const normalizedSentence = normalizeForCompare(firstSentence);
  const normalizedTitle = normalizeForCompare(title);
  if (
    normalizedSentence &&
    normalizedTitle &&
    (normalizedTitle.includes(normalizedSentence.slice(0, 12)) ||
      normalizedSentence.includes(normalizedTitle.slice(0, 12)) ||
      normalizedSentence.includes("…"))
  ) {
    return summary.slice(firstSentence.length).trim();
  }
  return summary;
}

function highlightTerms(item, headline = "") {
  const generic = new Set([
    "AI",
    "AI资讯",
    "资讯",
    "今日",
    "新闻",
    "官方",
    "英文媒体",
    "中文媒体",
    "播客",
    "技术",
    "公开来源链接",
    "参考雷达",
  ]);
  const fromTags = (item.tags ?? [])
    .map((tag) => String(tag).trim())
    .filter((tag) => tag && !generic.has(tag) && visibleLength(tag) >= 2);
  const fromTitle = (String(headline || item.title || "").match(/[A-Za-z][A-Za-z0-9.+-]{2,}/gu) ?? []).filter(isUsefulTitleTerm);
  return Array.from(new Set([...fromTags, ...fromTitle]))
    .filter((term) => !generic.has(term) && visibleLength(term) >= 2)
    .sort((a, b) => b.length - a.length)
    .slice(0, 6);
}

function editorialOverride(item) {
  const text = normalizeDigestText(
    `${item.title ?? ""} ${item.originalTitle ?? ""} ${item.sourceName ?? ""} ${item.sourceUrl ?? ""} ${item.aiSummary ?? ""}`,
  );
  return EDITORIAL_RULES.find((rule) => rule.match.test(text));
}

function primaryFocus(item) {
  return (
    (item.tags ?? [])
      .map((tag) => String(tag).trim())
      .find(
        (tag) =>
          tag &&
          !["AI", "AI资讯", "资讯", "今日", "新闻", "公开来源链接", "参考雷达", "英文媒体", "中文媒体"].includes(tag),
      ) ?? "AI"
  );
}

function fallbackHeadline(item) {
  const section = sectionTitle(item.section);
  const repo = githubRepoName(item.sourceUrl);
  if (repo) return `${repo} 开源项目进入今日观察`;

  const raw = normalizeDigestText(item.title || item.originalTitle);
  const named = extractNamedSubject(raw);
  if (named) return `${named} 进入今日${section}观察`;

  const host = sourceHostLabel(item.sourceUrl).trim();
  const focus = primaryFocus(item);
  if (/Reddit/i.test(item.sourceName ?? "")) return `${focus}社区实测进入今日观察`;
  if (/arXiv/i.test(item.sourceName ?? "")) return `${focus}论文进入今日${section}观察`;
  if (host) return `${host}${focus}信号进入今日观察`;
  return `${focus}信号进入今日${section}观察`;
}

function isGenericHeadline(value) {
  const text = normalizeDigestText(value).replace(/[\[\]【】]/g, "").trim();
  return (
    /相关信号进入今日重点/u.test(text) ||
    /^(论文|公开来源链接|开发者社区|英文媒体|中文媒体|Reddit|HN|Github|GitHub|X|推特动态|官方)$/iu.test(text)
  );
}

function githubRepoName(value) {
  try {
    const url = new URL(value);
    if (url.hostname.replace(/^www\./, "") !== "github.com") return "";
    const [owner, repo] = url.pathname.split("/").filter(Boolean);
    if (!owner || !repo) return "";
    return `${owner}/${repo.replace(/\.git$/i, "")}`;
  } catch {
    return "";
  }
}

function extractNamedSubject(value) {
  const text = normalizeDigestText(value)
    .replace(/[“”"']/g, "")
    .replace(/^[^A-Za-z\d\u4e00-\u9fff]+/u, "");
  const acronym = text.match(/\b[A-Z][A-Za-z0-9.+-]{2,}(?:[-\s][A-Z][A-Za-z0-9.+-]{2,}){0,2}\b/u)?.[0];
  if (acronym && !TITLE_TERM_STOP_WORDS.has(acronym.toLocaleLowerCase())) return acronym.trim();
  const camel = text.match(/\b[A-Za-z]+[A-Z][A-Za-z0-9.+-]*\b/u)?.[0];
  if (camel && !TITLE_TERM_STOP_WORDS.has(camel.toLocaleLowerCase())) return camel.trim();
  return "";
}

function stripLeadingByline(value) {
  let text = String(value ?? "").trim();
  text = text.replace(/^作者\s*[：:｜|]\s*[^。！？.!?]{1,60}?\s+编辑\s*[：:｜|]\s*[^。！？.!?\s]{1,12}\s*/u, "");
  text = text.replace(/^作者\s*[：:｜|]\s*[^。！？.!?]{1,60}?\s+(?=[“「\u4e00-\u9fff])/u, "");
  text = text.replace(/^编辑\s*[：:｜|]\s*[^。！？.!?]{1,40}?\s+(?=[“「\u4e00-\u9fff])/u, "");
  return text.trim();
}

function sourceLabel(item) {
  return String(item.sourceName ?? "公开信源").replace(/\s+/g, " ").trim();
}

function hasCjk(value) {
  return /[\u4e00-\u9fff]/u.test(String(value ?? ""));
}

function isUsefulTitleTerm(term) {
  const text = String(term ?? "").trim();
  if (!text || TITLE_TERM_STOP_WORDS.has(text.toLocaleLowerCase())) return false;
  return /[0-9.+-]/.test(text) || /[A-Z]/.test(text.slice(1)) || /^[A-Z][a-z]{2,}$/.test(text);
}

function renderMarkedText(value, terms) {
  const text = String(value ?? "");
  const filtered = terms.filter((term) => term && text.toLocaleLowerCase().includes(term.toLocaleLowerCase()));
  if (!filtered.length) return escapeHtml(text);
  const pattern = new RegExp(filtered.map(markPattern).join("|"), "giu");
  let out = "";
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    out += escapeHtml(text.slice(last, match.index));
    out += `<mark>${escapeHtml(match[0])}</mark>`;
    last = match.index + match[0].length;
  }
  out += escapeHtml(text.slice(last));
  return out;
}

function markPattern(term) {
  const escaped = escapeRegex(term);
  return /^[A-Za-z][A-Za-z0-9.+-]*$/.test(term) ? `\\b${escaped}s?\\b` : escaped;
}

function stripEnding(value) {
  return String(value ?? "").replace(/[。！？.!?]+$/g, "").trim();
}

function normalizeForCompare(value) {
  return String(value ?? "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLocaleLowerCase();
}

function visibleLength(value) {
  return Array.from(String(value ?? "")).length;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildDigest(summaries = []) {
  const digest = summaries
    .slice()
    .sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0))
    .slice(0, 6);
  if (digest.length === 0) {
    return `<div class="daily-digest"><p>今日暂无足够信号，等待下一次抓取。</p></div>`;
  }
  const items = digest
    .map((item, index) => `<li>
<span class="daily-digest__index">${String(index + 1).padStart(2, "0")}</span>
<div class="daily-digest__body">
<span class="daily-digest__section">${escapeHtml(sectionTitle(item.section))}</span>
<strong>${escapeHtml(displayHeadline(item))}</strong>
<p>${escapeHtml(digestNote(item))}</p>
</div>
</li>`)
    .join("\n");
  return `<div class="daily-digest">
<ol>
${items}
</ol>
</div>`;
}

function sectionTitle(section) {
  return SECTION_TITLES[SECTION_ORDER.includes(section) ? section : "industry"] ?? "行业观察";
}

function digestNote(item) {
  const note = cleanSignalSummary(item)
    .split(/[。.!?]\s*/u)
    .map((part) => part.trim())
    .find((part) => part && !/^评分[:：]/u.test(part) && !/^作者[:：]/u.test(part));
  return truncate(note || "这条信号进入今日重点池，发布前仍会复核来源、事实与影响判断。", 92);
}

function normalizeDigestText(value) {
  return decodeEntities(String(value ?? ""))
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function groupBySection(summaries) {
  const map = new Map();
  for (const item of summaries) {
    const section = SECTION_ORDER.includes(item.section) ? item.section : "industry";
    map.set(section, [...(map.get(section) ?? []), item]);
  }
  for (const [section, items] of map) {
    map.set(section, items.slice().sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0)));
  }
  return map;
}
