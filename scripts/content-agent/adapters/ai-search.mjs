import { cleanText, toIsoDate } from "../utils.mjs";

export async function fetchAISearchSource(source, { provider } = {}) {
  if (!source.enabled || !provider) return [];
  const results = await provider.generateJSON({
    instructions:
      "你是 AI 资讯检索员。只返回真实、可访问、有来源链接的 AI 行业动态，输出 JSON 数组，不要编造链接。",
    input: `检索关键词：${source.keyword}`,
    schema: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          description: { type: "string" },
          content: { type: "string" },
          author: { type: "string" },
          published_date: { type: "string" },
        },
        required: ["title", "url", "description", "content", "author", "published_date"],
      },
    },
  });

  return (Array.isArray(results) ? results : [])
    .filter((item) => item?.url)
    .map((item) => ({
      id: `${source.id}:${item.url}`,
      title: cleanText(item.title),
      url: item.url,
      sourceId: source.id,
      sourceName: item.author || source.name,
      sourceType: source.sourceType ?? "search",
      sourceWeight: source.weight,
      section: source.section,
      publishedAt: toIsoDate(item.published_date),
      content: cleanText(item.content || item.description),
      tags: source.tags ?? [],
      raw: { adapter: "ai-search" },
    }));
}
