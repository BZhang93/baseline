// Primary navigation for the authenticated app shell.
export const NAV_ITEMS = [
  { href: "/schedules", label: "My Schedules" },
  { href: "/browse", label: "Browse" },
  { href: "/profile", label: "Profile" },
] as const;

// A nav item is active for its own path and any nested path beneath it
// (e.g. "/schedules" is active on "/schedules/new").
export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
