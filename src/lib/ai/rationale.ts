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

// Guardrail on the rationale INPUT (review H3). `picks` and `context` arrive from
// the client, so before they become a paid LLM prompt we cap how many picks and
// how much text can be sent. A schedule is at most ~one event per week; 24 is
// comfortably above any real schedule, so this never truncates legitimate use but
// bounds a crafted call from inflating the prompt (and the bill).
export const MAX_RATIONALE_PICKS = 24;

const boundedString = (v: unknown, max: number): string =>
  typeof v === "string" ? v.slice(0, max) : "";
const finiteNumber = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

// Cap the pick list length and every field, coercing wrong types to safe values.
export function sanitizePickFacts(picks: PickFact[]): PickFact[] {
  return (Array.isArray(picks) ? picks : [])
    .slice(0, MAX_RATIONALE_PICKS)
    .map((p) => ({
      id: boundedString(p?.id, 64),
      name: boundedString(p?.name, 80),
      city: boundedString(p?.city, 60),
      country: boundedString(p?.country, 60),
      surface: boundedString(p?.surface, 24),
      expectedPoints: finiteNumber(p?.expectedPoints),
      expectedPrize: finiteNumber(p?.expectedPrize),
      reach: boundedString(p?.reach, 24),
    }));
}

// Cap the free-text context fields sent alongside the picks.
export function sanitizeRationaleContext(ctx: RationaleContext): RationaleContext {
  return {
    priorities: boundedString(ctx?.priorities, 200),
    note: ctx?.note ? boundedString(ctx.note, 400) : undefined,
  };
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
