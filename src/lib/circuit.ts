// Client-safe: imports enums (not the DB client), so it can be used in both
// server and client components.
import { Circuit, Tour } from "@/generated/prisma/enums";

// The tours available on each circuit.
export function toursForCircuit(circuit: Circuit): Tour[] {
  return circuit === Circuit.MENS
    ? [Tour.ATP, Tour.CHALLENGER, Tour.ITF]
    : [Tour.WTA, Tour.ITF];
}

// The ranking list used for the cutoff gap on each circuit.
export function rankingTourForCircuit(circuit: Circuit): Tour {
  return circuit === Circuit.MENS ? Tour.ATP : Tour.WTA;
}

// The circuit that owns a given ranking tour (for back-deriving from legacy
// data that only had rankingTour).
export function circuitForRankingTour(tour: Tour | null): Circuit | null {
  if (tour === Tour.ATP) return Circuit.MENS;
  if (tour === Tour.WTA) return Circuit.WOMENS;
  return null;
}

// The circuit a tournament belongs to. ATP/Challenger are men's, WTA is
// women's; ITF covers both, so its gender comes from the tier (ITF_M* vs
// ITF_W*, e.g. "ITF_M25" / "ITF_W25").
export function circuitForTournament(tour: Tour, tier: string): Circuit {
  if (tour === Tour.WTA) return Circuit.WOMENS;
  if (tour === Tour.ATP || tour === Tour.CHALLENGER) return Circuit.MENS;
  // ITF (or any future shared tour): read the gender marker from the tier.
  return /_W/i.test(tier) ? Circuit.WOMENS : Circuit.MENS;
}

// Resolves the Browse page's Tour filter from the player's profile:
//  - `options`: the tours shown in the dropdown (the player's circuit, or all
//    tours when there's no circuit / no player).
//  - `tour`: the single tour to filter by. On a fresh visit (no tour chosen
//    yet) it defaults to the player's tour when they compete on exactly one; an
//    out-of-circuit selection is dropped.
//  - `tours`: the set to filter by when no single tour applies. On a fresh
//    visit this is the player's own tours (personalized); once the player
//    explicitly picks "All tours" it widens to the whole circuit — an escape
//    hatch so they can always see every event on their circuit.
export function resolveBrowseTours(params: {
  circuit: Circuit | null;
  playerTours: Tour[];
  selectedTour: Tour | undefined;
  tourExplicit: boolean;
}): { tour?: Tour; tours?: Tour[]; options: Tour[] } {
  const { circuit, playerTours, selectedTour, tourExplicit } = params;
  const options = circuit ? toursForCircuit(circuit) : (Object.values(Tour) as Tour[]);
  const myTours = playerTours.filter((t) => options.includes(t));

  const tour = selectedTour && options.includes(selectedTour) ? selectedTour : undefined;

  // An explicit "All tours" (or a hand-edited URL) means the whole circuit,
  // never the player's saved subset.
  if (tourExplicit) {
    return { tour, tours: tour ? undefined : circuit ? options : undefined, options };
  }

  // Fresh visit: personalize to the player's tours.
  if (myTours.length === 1) return { tour: myTours[0], options };
  if (myTours.length > 1) return { tour: undefined, tours: myTours, options };
  return { tour: undefined, tours: circuit ? options : undefined, options };
}
