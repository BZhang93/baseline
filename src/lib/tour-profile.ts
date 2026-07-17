// Client-safe (no DB import): validate + label a player's linked official
// tour profile URL. Only the official ATP/WTA/ITF domains are accepted, so the
// ranking/results scraper has a trustworthy source to read from later.

interface TourProvider {
  label: string;
  // Hostnames (without www.) that identify this provider.
  hosts: string[];
}

const PROVIDERS: TourProvider[] = [
  { label: "ATP", hosts: ["atptour.com"] },
  { label: "WTA", hosts: ["wtatennis.com"] },
  { label: "ITF", hosts: ["itftennis.com"] },
];

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

// The provider a URL belongs to, or null if it isn't an accepted tour profile.
export function tourProfileProvider(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  const host = normalizeHost(parsed.hostname);
  const provider = PROVIDERS.find((p) => p.hosts.includes(host));
  return provider?.label ?? null;
}

export function isValidTourProfileUrl(url: string): boolean {
  return tourProfileProvider(url) !== null;
}
