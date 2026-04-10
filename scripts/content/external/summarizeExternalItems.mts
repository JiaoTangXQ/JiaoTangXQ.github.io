import type {
  ExternalContentCandidate,
  ExternalContentRecord,
} from "../../../src/lib/content/types.js";

type SummaryPayload = Pick<
  ExternalContentRecord,
  "summary" | "whyWorthReading"
>;

type SummarizeExternalItemsOptions = {
  summarizeCandidate?: (
    candidate: ExternalContentCandidate,
  ) => Promise<SummaryPayload>;
};

function buildFallbackSummary(candidate: ExternalContentCandidate): SummaryPayload {
  const baseSummary = candidate.rawExcerpt || `${candidate.title} 的外部内容摘要。`;
  const summary =
    baseSummary.length > 140 ? `${baseSummary.slice(0, 137)}...` : baseSummary;

  return {
    summary,
    whyWorthReading: "这条内容把你平时不太会主动点开的领域，压缩成了一个可快速理解的入口。",
  };
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

    items.push({
      slug: candidate.slug,
      contentType: "external",
      title: candidate.title,
      date: candidate.date,
      topics: candidate.topics,
      summary: payload.summary,
      whyWorthReading: payload.whyWorthReading,
      sourceName: candidate.sourceName,
      sourceUrl: candidate.sourceUrl,
      sourceDomain: candidate.sourceDomain,
      importance: 1,
      noveltyScore: 0,
      cover: { style: "gradient" },
    });
  }

  return items;
}
