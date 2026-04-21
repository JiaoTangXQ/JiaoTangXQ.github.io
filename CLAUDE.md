# 焦糖星球 — Claude Code 项目上下文

## 项目是什么

焦糖星球是一个以无限宇宙画布为载体的个人思想星图，部署在 GitHub Pages。不是传统博客模板，而是一个有强烈 art direction 的作品。

核心体验：
- 首页是 GPU 渲染的无限画布，文章以发光行星形态散布在宇宙中
- 文章按主题语义自动聚类成星系，距离表达相关性
- 远景传达宇宙壮阔感，近景展开高端 editorial 封面卡片
- 用户通过拖拽、缩放、漫游探索内容
- 默认有自动巡游，让宇宙始终"活着"

明确不要：传统博客框架感、普通列表页、精简但平庸的站。
明确要：精美、大胆、高端、有设计感、看起来像顶级个人作品。

## 技术栈

- Vite + React 19 + TypeScript
- Three.js + @react-three/fiber（GPU 渲染）
- 自定义 GLSL shaders（深空、星空、星云、行星节点）
- React Router（SPA 路由）
- gray-matter + remark + rehype（Markdown 内容管线）
- d3-force（构建时文章布局）
- MiniSearch（搜索）

## 架构

```
content/articles/*.md → scripts/ → public/data/cosmos.json
                                 → public/data/search-index.json

src/features/cosmos/shaders/    → GLSL (deepSpace, starField, nebula, planetNode)
src/features/cosmos/scene/      → R3F layers (DeepSpace, StarField, Nebula, Node)
src/features/cosmos/camera/     → useCamera, useAutoCruise, useGestures, CameraController, urlState
src/features/cosmos/components/ → CosmosViewport, SummaryCard, SearchPalette, ThemeLens, GalaxyCompass, NodeLabels, CosmosChrome
src/features/articles/          → ArticleLayout, NearbyPlanets
src/routes/                     → CosmosPage, ArticlePage
```

渲染管线 5 层：
1. Deep Space — fragment shader 深空渐变 + 漂移色彩场
2. Star Field — 4000 粒子星空，vertex shader 闪烁 + 视差
3. Nebula — simplex noise 星云，每个主题集群一片
4. Planet Nodes — 自定义 ShaderMaterial 发光球体
5. DOM Overlay — 标题标签、卡片、UI

## 常用命令

```bash
npm run dev              # 开发服务器
npm run refresh:content  # 抓外部源 → 规则过滤 → 抓正文 → 写入 items.json（零 LLM）
npm run build:data       # 重新生成 cosmos.json / search-index.json / 外部文章单文件
npm run build            # 完整生产构建
```

## 外部内容规则

刷新外部内容是**纯代码管线**，不再调用 LLM：

1. 并行抓 160 个 RSS/Atom 源 → `scripts/content/external/refresh.mts`
2. 规则过滤（`qualityFilter.mts`）去掉快讯、空帖、占位符
3. 对 RSS 摘录太短的条目尝试 `readability` 抓全文
4. 清洗 HTML、派生 `preview` 和 `language`，写入 `content/external/items.json`

**不做的事情**：
- 不翻译标题、不生成中文摘要（中文源保持中文，英文源保持英文）
- 不做立场标注、不生成"每日三题"
- 不做 qualityScore 智能评分（纯规则打分）

**必须遵守**：文章页底部必须展示 `本文原载于 {sourceName}` 和 `阅读原文` 链接。版权归原作者，我们只是内嵌阅读。`ArticleLayout.tsx` 已经内置这个版权区块，不要删。

## 发布流程

代码改动后发布到 https://jiaotangxq.github.io 只需要 push 到 master：

```bash
git add <改动的文件>
git commit -m "描述改动"
git push origin master
```

Push 之后 GitHub Actions 会自动执行：
1. `npm ci` 安装依赖
2. `npm run build`（生成 cosmos.json + search-index.json → Vite 构建 → 输出 dist/）
3. 部署 `dist/` 到 GitHub Pages

通常 1-2 分钟后页面生效。可以在仓库 Actions tab 查看构建状态。

**注意事项：**
- GitHub Pages Source 必须设为 **"GitHub Actions"**（Settings → Pages → Source），不能选 "Deploy from a branch"，否则会直接发布源码而不是构建产物
- 如果新增了文章（`content/articles/*.md`），构建时会自动重新计算布局和搜索索引
- 本地验证：先 `npm run build && npx vite preview` 确认没问题再 push

## 当前进度（v0.1）

已完成：
- 完整项目搭建和构建管线
- 5 层 GPU 渲染管线 + 4 个 GLSL shader
- 相机系统（自动巡游、拖拽/缩放/捏合、弹簧缓动、URL 持久化）
- 全部 UI 组件（SummaryCard、SearchPalette、ThemeLens、GalaxyCompass、NodeLabels）
- 文章页（封面、排版、Markdown 渲染、相关星球、返回导航）
- 5 篇示例文章
- Code splitting（Three.js 独立 chunk）

## 未来开发计划

### P1 — 视觉调优
- 浏览器中调试 shader 参数（星云密度、节点发光强度、星空亮度）
- 调整 LOD 阈值和过渡动画平滑度
- 优化节点大小和间距
- 移动端适配和手势优化

### P2 — 封面系统
- 每篇文章可高度定制的封面设计
- 封面配置扩展：自定义渐变、图片、排版方向
- 近景 LOD 封面卡片过渡动画

### P3 — 内容扩展
- 更多文章（20-50 篇验证性能和布局）
- AI 辅助内容管线：自动摘要、语义聚类
- 骑行、健身等新主题星系

### P4 — 部署和 SEO
- GitHub Pages 部署（404.html SPA 路由、CNAME）
- GitHub Actions 自动构建
- 预渲染文章页 HTML（SEO）
- Open Graph / Twitter Card 元数据

### P5 — 高级交互
- 文章页进入/退出的宇宙缩放过渡动画
- 搜索结果相机飞行效果
- 200+ 节点 instanced rendering
- 手动覆盖集群分配

### P6 — 大气层增强
- 流星、星尘粒子效果
- 多层 FBM 星云、边缘溶解
- 节点间微弱引力场视觉暗示
- 多层视差星空深度感

## 协作偏好

- 快速执行，少问多做。需求清晰时直接写代码。
- 利用并行 agent 加速开发。
- 只在真正影响架构的决策点停下来确认。
- 中文沟通。
- 对视觉品质要求极高，不接受"能用就行"的实现。
