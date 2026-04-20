import type {
  ExternalContentCandidate,
  ExternalContentRecord,
  ContentCategory,
} from "../../../src/lib/content/types.js";

export type AISummaryPayload = {
  titleZh: string;
  summary: string;
  whyWorthReading: string;
  topics: string[];
  contentCategory: ContentCategory;
  qualityScore: number;
};

type SummaryPayload = Pick<
  ExternalContentRecord,
  "summary" | "whyWorthReading" | "titleZh" | "contentCategory"
> & { topics?: string[]; qualityScore?: number };

type SummarizeExternalItemsOptions = {
  summarizeCandidate?: (
    candidate: ExternalContentCandidate,
  ) => Promise<SummaryPayload>;
};

const VALID_TOPICS = new Set([
  "技术", "AI", "科学", "社会", "文化", "历史",
  "哲学", "经济", "法律", "环境", "健康", "思考",
]);

const VALID_CATEGORIES = new Set<ContentCategory>([
  "research", "analysis", "opinion", "tutorial",
  "news", "announcement", "obituary", "event",
]);

function buildFallbackSummary(candidate: ExternalContentCandidate): SummaryPayload {
  const raw = candidate.rawExcerpt || "";
  const firstPara = raw.split(/\n\n+/)[0] ?? raw;
  const summary = firstPara.length > 400 ? firstPara.slice(0, 400) : firstPara;
  return {
    titleZh: undefined,
    summary: summary || candidate.title,
    whyWorthReading: "",
    contentCategory: "news",
  };
}

function qualityToImportance(score: number): number {
  if (score >= 0.9) return 3;
  if (score >= 0.75) return 2;
  return 1;
}

export async function summarizeExternalItems(
  candidates: ExternalContentCandidate[],
  options: SummarizeExternalItemsOptions = {},
): Promise<ExternalContentRecord[]> {
  const items: ExternalContentRecord[] = [];

  for (const candidate of candidates) {
    const payload = options.summarizeCandidate
      ? await options.summarizeCandidate(candidate)
      : buildFallbackSummary(candidate);

    // Validate and clean topics from AI
    const aiTopics = (payload.topics ?? []).filter((t) => VALID_TOPICS.has(t));
    const finalTopics = aiTopics.length >= 1 ? aiTopics : candidate.topics;

    // Validate contentCategory
    const category = (payload.contentCategory && VALID_CATEGORIES.has(payload.contentCategory))
      ? payload.contentCategory
      : "news";

    const qualityScore = payload.qualityScore ?? 0.7;

    items.push({
      slug: candidate.slug,
      contentType: "external",
      title: candidate.title,
      titleZh: payload.titleZh || undefined,
      date: candidate.date,
      topics: finalTopics.slice(0, 3),
      summary: payload.summary,
      body: candidate.rawExcerpt || undefined,
      whyWorthReading: payload.whyWorthReading,
      sourceName: candidate.sourceName,
      sourceUrl: candidate.sourceUrl,
      sourceDomain: candidate.sourceDomain,
      importance: qualityToImportance(qualityScore),
      noveltyScore: qualityScore,
      contentCategory: category,
      cover: { style: "gradient" },
    });
  }

  return items;
}
