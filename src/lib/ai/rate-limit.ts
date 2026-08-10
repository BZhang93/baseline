// Per-user AI rate limit (review H4). The AI actions call a paid LLM; without a
// cap, one authenticated user (a script, a runaway retry loop, or deliberate
// abuse) can run up unbounded spend. This bounds calls per user per rolling
// window. Imported only from the "use server" actions (server-only by usage; the
// `import "server-only"` marker is omitted so the pure logic stays unit-testable,
// matching plan-intent.ts / rationale.ts).
//
// The decision logic (`decideRate`) is pure and unit-tested. The store below is
// an in-process Map: it caps bursts per server instance, which is adequate for
// the current single-region deployment. For multi-instance/serverless scale,
// swap `store` for a shared backend (Redis or a Postgres counter) keyed by the
// same playerId — the check logic does not change.

export interface RateWindow {
  windowStartedAt: number; // epoch ms
  count: number;
}

export interface RateDecision {
  ok: boolean;
  retryAfterSeconds?: number; // present when !ok
}

// Sliding fixed-window decision: given the previous window state and `now`,
// return the next state plus whether this call is allowed. Pure — exported for
// tests. A new window starts when there's no prior state or the window elapsed.
export function decideRate(
  prev: RateWindow | undefined,
  now: number,
  limit: number,
  windowMs: number,
): { next: RateWindow; decision: RateDecision } {
  if (!prev || now - prev.windowStartedAt >= windowMs) {
    return { next: { windowStartedAt: now, count: 1 }, decision: { ok: true } };
  }
  if (prev.count >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((prev.windowStartedAt + windowMs - now) / 1000),
    );
    return { next: prev, decision: { ok: false, retryAfterSeconds } };
  }
  return { next: { ...prev, count: prev.count + 1 }, decision: { ok: true } };
}

export const AI_RATE_LIMIT = 30; // AI calls per user per window
export const AI_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const store = new Map<string, RateWindow>();

// Records one AI call for `playerId` and reports whether it's within quota.
// `now` is injectable for tests.
export function checkAiRateLimit(playerId: string, now: number = Date.now()): RateDecision {
  const { next, decision } = decideRate(
    store.get(playerId),
    now,
    AI_RATE_LIMIT,
    AI_RATE_WINDOW_MS,
  );
  store.set(playerId, next);
  return decision;
}
