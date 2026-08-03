import "server-only";

// Minimal LLM client for the AI layer (BRA-47). Provider-agnostic env var
// (AI_API_KEY); currently DeepSeek, which is OpenAI-compatible, so this is a
// plain chat-completions POST — no SDK dependency. The LLM only ever produces
// optimizer INPUTS or grounded prose; the deterministic optimizer still decides
// which events to enter.

const AI_BASE_URL = process.env.AI_BASE_URL ?? "https://api.deepseek.com";
const AI_MODEL = process.env.AI_MODEL ?? "deepseek-chat";

export function aiConfigured(): boolean {
  return !!process.env.AI_API_KEY;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured (AI_API_KEY is not set).");
    this.name = "AiNotConfiguredError";
  }
}

interface ChatOptions {
  json?: boolean; // ask for a strict JSON object back
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

// Single chat turn (system + user) → assistant text. Throws AiNotConfiguredError
// when there's no key, or Error on a non-2xx / malformed response.
export async function aiChat(
  system: string,
  user: string,
  opts: ChatOptions = {},
): Promise<string> {
  const key = process.env.AI_API_KEY;
  if (!key) throw new AiNotConfiguredError();

  const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 900,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI response had no content.");
  return content;
}

// Convenience: a JSON-mode turn parsed into an object. Returns null if the model
// returned something that isn't a JSON object, so callers validate/normalize.
export async function aiChatJson(
  system: string,
  user: string,
  opts: Omit<ChatOptions, "json"> = {},
): Promise<Record<string, unknown> | null> {
  const text = await aiChat(system, user, { ...opts, json: true });
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
