export function createAIProvider(config = {}) {
  if (config.provider === "mock") return createMockProvider();
  if (!config.apiKey) return null;
  return createOpenAIResponsesProvider(config);
}

export function createMockProvider() {
  return {
    async generateJSON({ input }) {
      return {
        title: "焦糖星球信号更新",
        aiSummary: `焦糖星球已接收这条候选信号。它和 AI 工程化、模型能力或行业结构有关。发布前仍需人工复核来源和事实。输入摘要：${String(input).slice(0, 80)}`,
        aiScore: 72,
        reason: "本地 mock provider 生成；未调用远程模型。",
        tags: ["AI资讯", "人工复核"],
        section: "industry",
      };
    },
  };
}

export function createOpenAIResponsesProvider(config) {
  const baseUrl = String(config.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = config.model ?? "gpt-5.4";
  const apiKey = config.apiKey;
  const reasoningEffort = config.reasoningEffort ?? "low";

  return {
    async generateJSON({ instructions, input, schema, name = "content_agent_result", maxOutputTokens = 1400 }) {
      const payload = {
        model,
        instructions,
        input,
        max_output_tokens: maxOutputTokens,
        reasoning: { effort: reasoningEffort },
        text: {
          format: schema
            ? {
                type: "json_schema",
                name,
                strict: true,
                schema,
              }
            : { type: "json_object" },
        },
      };
      const response = await fetch(`${baseUrl}/responses`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`AI provider HTTP ${response.status}: ${json?.error?.message ?? response.statusText}`);
      }
      const text = extractResponseText(json);
      if (!text) throw new Error("AI provider returned no output_text");
      return JSON.parse(text);
    },
  };
}

export function extractResponseText(response) {
  if (typeof response?.output_text === "string") return response.output_text;
  const chunks = [];
  for (const item of response?.output ?? []) {
    if (item.type !== "message") continue;
    for (const content of item.content ?? []) {
      if (content.type === "output_text") chunks.push(content.text);
    }
  }
  return chunks.join("").trim();
}
