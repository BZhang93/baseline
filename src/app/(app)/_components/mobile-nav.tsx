"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavActive } from "@/lib/nav";

// Bottom tab bar for phones (BRA-91) — first-class one-tap nav instead of a
// wrapping top row. Hidden at sm+ where the top nav takes over.
const TABS = [
  ...NAV_ITEMS.map((i) => ({ href: i.href, label: i.label === "My Schedules" ? "Schedules" : i.label })),
  { href: "/schedules/new", label: "＋ New" },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-gray-200 bg-white sm:hidden">
      {TABS.map((t) => {
        // The "New" tab matches only its exact route so it and Schedules don't
        // both light up on /schedules/new.
        const active =
          t.href === "/schedules/new" ? pathname === t.href : isNavActive(pathname, t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`flex-1 py-2.5 text-center text-xs ${
              active ? "font-semibold text-black" : "text-gray-500"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
