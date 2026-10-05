import type { Config } from "../config";

export interface LlmRequest {
  system: string;
  user: string;
  maxTokens?: number;
}

export interface LlmProvider {
  /** e.g. "anthropic:claude-sonnet-5-5" — stored with each draft for provenance. */
  name: string;
  complete(req: LlmRequest): Promise<string>;
}

type FetchLike = typeof fetch;

const TIMEOUT_MS = 45_000;

/** Anthropic Messages API. */
export function anthropicProvider(apiKey: string, model: string, fetchImpl: FetchLike = fetch): LlmProvider {
  return {
    name: `anthropic:${model}`,
    async complete({ system, user, maxTokens = 1800 }) {
      const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.4, system, messages: [{ role: "user", content: user }] }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      const text = data.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("") ?? "";
      if (!text) throw new Error("Anthropic API returned no text");
      return text;
    },
  };
}

/** Any OpenAI-compatible /chat/completions endpoint: OpenAI, OpenRouter, Together, vLLM/Ollama, Hermes gateways… */
export function openaiCompatibleProvider(
  baseUrl: string,
  apiKey: string,
  model: string,
  fetchImpl: FetchLike = fetch,
): LlmProvider {
  const isOpenAi = /(^|\/\/)api\.openai\.com/.test(baseUrl);
  return {
    name: `openai:${model}`,
    async complete({ system, user, maxTokens = 1800 }) {
      const res = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          // JSON mode is only guaranteed on OpenAI proper; many compatible servers reject the parameter.
          ...(isOpenAi || process.env.LLM_JSON_MODE === "1" ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`LLM API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error("LLM API returned no content");
      return text;
    },
  };
}

export function createLlm(config: Config, fetchImpl: FetchLike = fetch): LlmProvider | null {
  const { provider, apiKey, model, baseUrl } = config.llm;
  if (!apiKey || provider === "none") return null;
  return provider === "anthropic"
    ? anthropicProvider(apiKey, model, fetchImpl)
    : openaiCompatibleProvider(baseUrl, apiKey, model, fetchImpl);
}
