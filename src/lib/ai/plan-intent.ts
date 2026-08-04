// The natural-language front door for the optimizer (BRA-47). The LLM extracts
// a PlanIntent — optimizer INPUTS (weights + constraints + filters) — from a
// plain-language request. It never selects events; the deterministic optimizer
// consumes these inputs. `normalizePlanIntent` is the guardrail that sanitizes
// the model's raw JSON into a safe, bounded intent (pure + unit-tested; no
// server-only import so it runs under vitest).

import { Surface, Tour } from "@/generated/prisma/enums";

export interface PlanIntent {
  restPriority?: number; // 0-100, protect body / minimize travel time
  costPriority?: number; // 0-100, minimize travel cost
  goalPriority?: number; // 0-100, prize money (0) <-> ranking points (100)
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  surfaces?: Surface[];
  tours?: Tour[];
  regions?: string[]; // continent/country names (matched downstream)
  budgetCap?: number;
  maxEvents?: number;
  minRestDays?: number;
  note?: string; // soft preference we couldn't structure, for the rationale
}

const SURFACES = new Set(Object.values(Surface) as string[]);
const TOURS = new Set(Object.values(Tour) as string[]);

function toInt(v: unknown, lo: number, hi: number): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return undefined;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function toYmd(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  return Number.isNaN(new Date(s).getTime()) ? undefined : s;
}

function toStrArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim());
  return out.length ? out : undefined;
}

function toEnumArray<T extends string>(v: unknown, valid: Set<string>): T[] | undefined {
  const arr = toStrArray(v);
  if (!arr) return undefined;
  const out = [...new Set(arr.map((x) => x.toUpperCase()).filter((x) => valid.has(x)))] as T[];
  return out.length ? out : undefined;
}

// Sanitize the model's raw JSON into a bounded PlanIntent. Unknown/invalid
// fields are dropped, numbers clamped, enums filtered, so nothing downstream
// ever trusts the LLM's output shape.
export function normalizePlanIntent(raw: Record<string, unknown> | null | undefined): PlanIntent {
  if (!raw) return {};
  const intent: PlanIntent = {};

  const rest = toInt(raw.restPriority, 0, 100);
  if (rest !== undefined) intent.restPriority = rest;
  const cost = toInt(raw.costPriority, 0, 100);
  if (cost !== undefined) intent.costPriority = cost;
  const goal = toInt(raw.goalPriority, 0, 100);
  if (goal !== undefined) intent.goalPriority = goal;

  const from = toYmd(raw.from);
  if (from) intent.from = from;
  const to = toYmd(raw.to);
  if (to) intent.to = to;
  // Reversed window is meaningless — drop both and let the caller default.
  if (intent.from && intent.to && intent.to < intent.from) {
    delete intent.from;
    delete intent.to;
  }

  const surfaces = toEnumArray<Surface>(raw.surfaces, SURFACES);
  if (surfaces) intent.surfaces = surfaces;
  const tours = toEnumArray<Tour>(raw.tours, TOURS);
  if (tours) intent.tours = tours;
  const regions = toStrArray(raw.regions);
  if (regions) intent.regions = regions.slice(0, 12);

  const budgetCap = toInt(raw.budgetCap, 0, 10_000_000);
  if (budgetCap !== undefined) intent.budgetCap = budgetCap;
  const maxEvents = toInt(raw.maxEvents, 1, 52);
  if (maxEvents !== undefined) intent.maxEvents = maxEvents;
  const minRestDays = toInt(raw.minRestDays, 0, 60);
  if (minRestDays !== undefined) intent.minRestDays = minRestDays;

  if (typeof raw.note === "string" && raw.note.trim()) intent.note = raw.note.trim().slice(0, 400);

  return intent;
}

export const PLAN_SYSTEM_PROMPT = `You translate a tennis player's plain-language planning request into structured INPUTS for a deterministic schedule optimizer. You do NOT pick tournaments or build the schedule — you only extract preferences and constraints. Respond with a single JSON object and nothing else.

Fields (all optional — OMIT any the player did not imply; never guess):
- restPriority: integer 0-100. Protecting the body / minimizing travel time and back-to-backs. Higher = more rest-focused.
- costPriority: integer 0-100. Minimizing travel cost. Higher = more cost-sensitive.
- goalPriority: integer 0-100. Prize money (0) to ranking points (100); 50 = balanced. Higher when chasing ranking, lower when chasing prize money.
- from, to: dates "YYYY-MM-DD" bounding the planning window.
- surfaces: array from "HARD","CLAY","GRASS".
- tours: array from "ATP","WTA","CHALLENGER","ITF".
- regions: array of region/continent or country names (e.g. "Europe","South America","Spain").
- budgetCap: integer travel-cost ceiling in the player's currency.
- maxEvents: integer cap on number of events.
- minRestDays: integer minimum rest days between events.
- note: short free text for any soft preference you could not structure (e.g. "avoid back-to-back long-hauls").`;

export function buildPlanUserPrompt(
  text: string,
  ctx: { today: string; circuit?: string | null; tours?: string[] },
): string {
  return [
    `Today is ${ctx.today}.`,
    ctx.circuit
      ? `The player competes on the ${ctx.circuit} circuit${
          ctx.tours?.length ? ` (tours: ${ctx.tours.join(", ")})` : ""
        }.`
      : "",
    `Player request: """${text.slice(0, 1000)}"""`,
  ]
    .filter(Boolean)
    .join("\n");
}
