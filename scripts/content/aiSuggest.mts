/**
 * AI 辅助内容管线
 *
 * 使用 Claude API 为文章生成/优化：
 * - 摘要（summary）
 * - 主题标签（topics）建议
 * - importance 评估
 *
 * 用法：
 *   ANTHROPIC_API_KEY=sk-... tsx scripts/content/aiSuggest.mts [slug]
 *
 * 不加 slug 则处理所有缺少 summary 的文章。
 * 不会自动修改文件，只输出建议到 stdout。
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const ARTICLES_DIR = path.resolve("content/articles");
const KNOWN_TOPICS = [
  "技术",
  "AI",
  "思考",
  "骑行",
  "健身",
  "科学",
  "社会",
  "环境",
  "健康",
  "历史",
  "文化",
  "哲学",
  "经济",
  "法律",
];

const API_KEY = process.env.ANTHROPIC_API_KEY;
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

if (!API_KEY) {
  console.error("❌ 请设置 ANTHROPIC_API_KEY 环境变量");
  console.error("   用法: ANTHROPIC_API_KEY=sk-... tsx scripts/content/aiSuggest.mts [slug]");
  process.exit(1);
}

type Suggestion = {
  summary: string;
  topics: string[];
  importance: number;
};

async function callClaude(prompt: string): Promise<string> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.content[0].text;
}

async function suggestForArticle(
  file: string,
  title: string,
  body: string,
  currentTopics: string[],
  currentSummary: string,
): Promise<Suggestion> {
  const prompt = `你是焦糖星球的内容编辑。焦糖星球是一个以宇宙画布为载体的个人思想星图。

已知主题分类：${KNOWN_TOPICS.join("、")}

请为以下文章提供建议，输出 JSON 格式（不要 markdown 代码块）：

文件名：${file}
标题：${title}
当前主题：${currentTopics.join(", ") || "无"}
当前摘要：${currentSummary || "无"}

文章正文（前 1500 字）：
${body.slice(0, 1500)}

请输出如下 JSON：
{
  "summary": "一句话摘要（40-80 字，要有洞察力，不要平淡描述）",
  "topics": ["推荐的主题标签，从已知主题中选择，最多 2 个"],
  "importance": 1.0
}

importance 说明：1.0 = 普通，1.2 = 重要，1.4 = 核心文章。根据文章深度和价值判断。`;

  const raw = await callClaude(prompt);

  try {
    // 尝试解析 JSON（Claude 可能包裹在代码块中）
    const cleaned = raw.replace(/```json?\s*\n?/g, "").replace(/```\s*$/g, "").trim();
    return JSON.parse(cleaned) as Suggestion;
  } catch {
    console.error(`⚠ 解析失败，原始响应：\n${raw}`);
    return {
      summary: currentSummary || "（AI 建议解析失败）",
      topics: currentTopics,
      importance: 1.0,
    };
  }
}

// --- 主流程 ---
const targetSlug = process.argv[2];

const files = fs
  .readdirSync(ARTICLES_DIR)
  .filter((f) => f.endsWith(".md"))
  .sort();

let processed = 0;

for (const file of files) {
  const raw = fs.readFileSync(path.join(ARTICLES_DIR, file), "utf-8");
  const { data, content } = matter(raw);

  // 如果指定了 slug，只处理该文章
  if (targetSlug && data.slug !== targetSlug) continue;

  console.log(`\n📝 ${file} — ${data.title}`);
  console.log(`   当前摘要: ${data.summary || "（无）"}`);
  console.log(`   当前主题: ${(data.topics || []).join(", ") || "（无）"}`);

  try {
    const suggestion = await suggestForArticle(
      file,
      data.title,
      content,
      data.topics || [],
      data.summary || "",
    );

    console.log(`\n   💡 建议摘要: ${suggestion.summary}`);
    console.log(`   💡 建议主题: ${suggestion.topics.join(", ")}`);
    console.log(`   💡 建议重要度: ${suggestion.importance}`);

    // 如果与当前值不同，提示差异
    if (suggestion.summary !== data.summary) {
      console.log(`   📌 摘要有变化`);
    }
    if (JSON.stringify(suggestion.topics) !== JSON.stringify(data.topics)) {
      console.log(`   📌 主题有变化`);
    }

    processed++;
  } catch (err) {
    console.error(`   ❌ 处理失败: ${err}`);
  }
}

if (processed === 0 && targetSlug) {
  console.error(`❌ 未找到 slug 为 "${targetSlug}" 的文章`);
  process.exit(1);
}

console.log(`\n✓ 处理完成：${processed} 篇文章`);
console.log("💡 提示：建议内容仅供参考，请手动更新 frontmatter");
