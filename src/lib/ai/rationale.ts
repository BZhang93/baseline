// Grounded per-event rationale (BRA-47). The LLM turns the optimizer's ACTUAL
// numbers into a one-line "why" per pick — it is fed the facts and told to use
// only them, never to invent figures. `normalizeRationales` is the guardrail:
// it forces the output to a plain string per pick, in order. Pure (no
// server-only import) so it runs under vitest.

export interface PickFact {
  id: string;
  name: string;
  city: string;
  country: string;
  surface: string;
  expectedPoints: number;
  expectedPrize: number;
  reach: string; // acceptance/reachability, e.g. "in" | "borderline" | "reach" | "unknown"
}

export interface RationaleContext {
  priorities: string; // short description of the player's weighting, e.g. "rest-focused; cost-sensitive"
  note?: string; // soft preference the optimizer can't model, as a nudge for the narrative
}

// Coerce the model's raw output into exactly `count` trimmed strings, in order.
// Accepts { rationales: string[] } or a bare string[]; pads/truncates to length.
export function normalizeRationales(raw: unknown, count: number): string[] {
  const arr = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { rationales?: unknown }).rationales)
      ? (raw as { rationales: unknown[] }).rationales
      : [];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const v = arr[i];
    out.push(typeof v === "string" ? v.trim().slice(0, 240) : "");
  }
  return out;
}

export const RATIONALE_SYSTEM_PROMPT = `You explain why a tennis schedule optimizer picked each event, for a player. You are given the optimizer's chosen events with their real numbers and the player's priorities. Write ONE short sentence per event saying why it fits, using ONLY the numbers provided. Never invent points, prize, ranks, or probabilities. Ground each "why" in the given expectedPoints / expectedPrize / reach and the player's priorities. Respond with a single JSON object: {"rationales": ["...", "..."]} with one string per event, in the same order as the input. Keep each under 25 words.`;

export function buildRationaleUserPrompt(picks: PickFact[], ctx: RationaleContext): string {
  const lines = picks.map(
    (p, i) =>
      `${i + 1}. ${p.name} — ${p.city}, ${p.country}; ${p.surface.toLowerCase()}; ` +
      `~${p.expectedPoints} expected pts; ~$${p.expectedPrize} expected prize; reachability: ${p.reach}`,
  );
  return [
    `Player priorities: ${ctx.priorities}.`,
    ctx.note ? `Soft preference: ${ctx.note}.` : "",
    `Chosen events (in order):`,
    ...lines,
  ]
    .filter(Boolean)
    .join("\n");
}
