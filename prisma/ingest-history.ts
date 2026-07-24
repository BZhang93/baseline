// Historical-cutoff ingestion (BRA-106). Reads a match-level CSV (Sackmann
// format), derives each event's prior-edition direct-acceptance cutoff, matches
// it to our current events by city, and reports current-vs-derived. With
// --write it updates each matched event's historicalCutoffRank.
//
// The data SOURCE is decoupled: pass --file <path> to a CSV you obtained however
// (mirror, API export, download). With no --file it uses a small SAMPLE fixture
// (illustrative numbers only) so the pipeline can be demonstrated end-to-end.
//
//   pnpm ingest:history                                   # dry run vs the sample
//   pnpm ingest:history --file atp_matches.csv --tour atp # dry run vs real data
//   pnpm ingest:history --file atp_matches.csv --tour atp --write  # populate
//
// Run once per tour (--tour atp | wta) since ATP/WTA are separate source files
// and a city (e.g. Washington) can host both.
//
// Runs where there's internet + DB access (uses DIRECT_URL, like the seed).
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseMatchesCsv, deriveEventCutoffs, matchCutoffsByCity } from "../src/lib/data/history";
import { seedDataSource } from "../src/lib/data/seed-source";
import { circuitForTournament } from "../src/lib/circuit";
import { Circuit } from "../src/generated/prisma/enums";

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.join(here, "../src/lib/data/__fixtures__/sample_matches.csv");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const file = arg("--file") ?? SAMPLE;
  const write = process.argv.includes("--write");
  const usingSample = file === SAMPLE;

  const csv = readFileSync(file, "utf8");
  const cutoffs = deriveEventCutoffs(parseMatchesCsv(csv));
  console.log(
    `Parsed ${cutoffs.length} historical events from ${usingSample ? "the SAMPLE fixture (illustrative only)" : file}.`,
  );

  // Match by city, scoped to one circuit — ATP/WTA come from separate source
  // files, and a city can host both (Washington DC), so --tour avoids conflating
  // the men's and women's cutoffs. Omit --tour only for the mixed sample.
  const tour = arg("--tour")?.toLowerCase();
  const circuit = tour === "atp" ? Circuit.MENS : tour === "wta" ? Circuit.WOMENS : null;
  if (tour && !circuit) throw new Error(`--tour must be "atp" or "wta" (got "${tour}")`);

  const tournaments = await seedDataSource.tournaments();
  const scoped = circuit
    ? tournaments.filter((t) => circuitForTournament(t.tour, t.tier) === circuit)
    : tournaments;
  const events = scoped.map((t) => ({ key: t.name, city: t.city }));
  const derived = matchCutoffsByCity(cutoffs, events);

  const currentHist = new Map(
    tournaments.map((t) => [t.name, t.cutoff?.historicalCutoffRank ?? null]),
  );

  console.log("\nevent                                   current  derived");
  const matched = [...derived.entries()];
  for (const [name, rank] of matched) {
    console.log(`${name.padEnd(38)} ${String(currentHist.get(name) ?? "—").padStart(7)}  ${String(rank).padStart(7)}`);
  }
  if (matched.length === 0) console.log("(no current events matched this dataset by city)");

  if (!write) {
    console.log(`\nDry run — pass --write to update historicalCutoffRank for the ${matched.length} matched event(s).`);
    return;
  }
  if (usingSample) {
    throw new Error("Refusing to --write from the SAMPLE fixture; pass --file with real data.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
  });
  try {
    let updated = 0;
    for (const [name, rank] of matched) {
      const t = await prisma.tournament.findFirst({ where: { name }, select: { id: true } });
      if (!t) continue;
      await prisma.cutoff.upsert({
        where: { tournamentId: t.id },
        create: { tournamentId: t.id, historicalCutoffRank: rank, source: "sackmann-format:derived" },
        update: { historicalCutoffRank: rank, source: "sackmann-format:derived" },
      });
      updated++;
    }
    console.log(`\nWrote historicalCutoffRank for ${updated} event(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
