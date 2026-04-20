/**
 * 第三步（skill 里 agent 产出摘要之后）：把 agent 写到 pending-summaries/ 的单条 JSON
 * 合并进 items.json，经过 scoreExternalItems 过滤后落盘。
 *
 * 输入：
 *   - content/external/candidates.json （fetchCandidates 的输出）
 *   - content/external/pending-summaries/*.json （agent 产出，每条一个文件，文件名=slug.json）
 *
 * 输出：
 *   - content/external/items.json （并入，保留既有 + 新通过）
 *   - content/external/pending-summaries/_applied/ 下归档已合并的文件
 */
import fs from "node:fs";
import path from "node:path";
import type {
  ExternalContentCandidate,
  ExternalContentRecord,
} from "../../../src/lib/content/types.js";
import { summarizeExternalItems } from "./summarizeExternalItems.mjs";
import { scoreExternalItems } from "./scoreExternalItems.mjs";

const CANDIDATES_PATH = path.resolve("content/external/candidates.json");
const ITEMS_PATH = path.resolve("content/external/items.json");
const PENDING_DIR = path.resolve("content/external/pending-summaries");
const APPLIED_DIR = path.join(PENDING_DIR, "_applied");

type AgentSummary = {
  slug: string;
  titleZh?: string;
  summary: string;
  whyWorthReading: string;
  topics?: string[];
  contentCategory?: string;
  qualityScore?: number;
  stance?: string;
  language?: string;
};

function readJsonSafe<T>(p: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function main() {
  if (!fs.existsSync(CANDIDATES_PATH)) {
    console.error("❌ 找不到 candidates.json，先跑 fetchCandidates.mts");
    process.exit(1);
  }
  if (!fs.existsSync(PENDING_DIR)) {
    console.error(`❌ 找不到 ${PENDING_DIR}，agent 还没产出摘要`);
    process.exit(1);
  }

  const candidates = readJsonSafe<ExternalContentCandidate[]>(CANDIDATES_PATH, []);
  const candidateBySlug = new Map(candidates.map((c) => [c.slug, c]));

  const pendingFiles = fs
    .readdirSync(PENDING_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"));

  if (pendingFiles.length === 0) {
    console.log("⚠ pending-summaries/ 为空，无事可做");
    return;
  }

  console.log(`📥 读取 ${pendingFiles.length} 条待合并摘要...`);

  fs.mkdirSync(APPLIED_DIR, { recursive: true });

  const summaries = new Map<string, AgentSummary>();
  const badFiles: string[] = [];
  for (const f of pendingFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(PENDING_DIR, f), "utf8")) as AgentSummary;
      if (!data.slug || !data.summary || !data.whyWorthReading) {
        badFiles.push(f);
        continue;
      }
      summaries.set(data.slug, data);
    } catch {
      badFiles.push(f);
    }
  }
  if (badFiles.length > 0) {
    console.warn(`⚠ 跳过 ${badFiles.length} 个格式不对的文件: ${badFiles.slice(0, 5).join(", ")}`);
  }

  // Build enriched candidates list for summarizeExternalItems
  const matchedCandidates: ExternalContentCandidate[] = [];
  const unmatchedSlugs: string[] = [];
  for (const slug of summaries.keys()) {
    const cand = candidateBySlug.get(slug);
    if (!cand) {
      unmatchedSlugs.push(slug);
      continue;
    }
    matchedCandidates.push(cand);
  }
  if (unmatchedSlugs.length > 0) {
    console.warn(
      `⚠ ${unmatchedSlugs.length} 条 summary 的 slug 在 candidates 里找不到，会跳过`,
    );
  }

  // 注入 agent 产出到 summarize pipeline
  const summarized: ExternalContentRecord[] = await summarizeExternalItems(
    matchedCandidates,
    {
      summarizeCandidate: async (candidate) => {
        const s = summaries.get(candidate.slug);
        if (!s) {
          // shouldn't happen — we only built matchedCandidates from keys that exist
          return {
            summary: candidate.rawExcerpt.slice(0, 300) || candidate.title,
            whyWorthReading: "",
          };
        }
        return {
          titleZh: s.titleZh,
          summary: s.summary,
          whyWorthReading: s.whyWorthReading,
          topics: s.topics,
          contentCategory: s.contentCategory as ExternalContentRecord["contentCategory"],
          qualityScore: typeof s.qualityScore === "number"
            ? Math.max(0, Math.min(1, s.qualityScore))
            : undefined,
        };
      },
    },
  );

  // Attach stance / language (summarizeExternalItems doesn't know about these)
  const withMeta = summarized.map((rec) => {
    const s = summaries.get(rec.slug);
    if (!s) return rec;
    return {
      ...rec,
      stance: (s.stance as ExternalContentRecord["stance"]) ?? rec.stance,
      language: s.language ?? rec.language,
    };
  });

  // Merge with existing items
  const existing = readJsonSafe<ExternalContentRecord[]>(ITEMS_PATH, []);
  const existingBySlug = new Map(existing.map((e) => [e.slug, e]));
  for (const rec of withMeta) {
    existingBySlug.set(rec.slug, rec);
  }
  const merged = [...existingBySlug.values()];

  // Score + filter only the newly-added ones for quality; keep existing as-is
  // We score the whole set so importance/novelty are stable
  const approved = scoreExternalItems(merged, { existingTitles: [] });

  console.log("");
  console.log(`✅ 合并完成`);
  console.log(`  • 既有 items：${existing.length}`);
  console.log(`  • 本批新增 summary：${withMeta.length}`);
  console.log(`  • 合并后总数：${merged.length}`);
  console.log(`  • 质量过滤通过：${approved.length}（淘汰 ${merged.length - approved.length}）`);

  fs.writeFileSync(ITEMS_PATH, JSON.stringify(approved, null, 2));
  console.log(`  • 已写入 ${path.relative(process.cwd(), ITEMS_PATH)}`);

  // Archive processed files
  let archived = 0;
  for (const f of pendingFiles) {
    const from = path.join(PENDING_DIR, f);
    const to = path.join(APPLIED_DIR, f);
    try {
      fs.renameSync(from, to);
      archived++;
    } catch {
      // ignore
    }
  }
  console.log(`  • 归档 ${archived} 个 pending 文件到 _applied/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
