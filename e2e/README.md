# End-to-end tests (Playwright)

Browser tests for the real UI, complementing the Vitest unit tests in `src/`.

## Layout

- `*.public.spec.ts` — signed-out flows (landing, login, route guards). No
  account or backend data required beyond the app being reachable.
- `*.authed.spec.ts` — signed-in flows. Reuse a session captured once by
  `auth.setup.ts` (the `setup` project runs first).
- `auth.setup.ts` — logs in via the form and saves the session to
  `e2e/.auth/user.json` (git-ignored).
- `fixtures.ts` — the shared `test`/`expect` used by the specs. It adds an
  automatic guard that **fails any test whose page logs a `console.error` or
  throws an uncaught exception** (hydration mismatches, thrown effects, etc.).
  Import `test`/`expect` from here, not from `@playwright/test`, to get it.

## Running

```bash
# Public specs only — no credentials needed. Starts `pnpm dev` automatically.
pnpm test:e2e --project=public

# Everything, including authed specs — needs a test account:
E2E_EMAIL="you@example.com" E2E_PASSWORD="…" pnpm test:e2e

# Against a deployed preview instead of a local server:
PLAYWRIGHT_BASE_URL="https://<preview>.vercel.app" pnpm test:e2e --project=public

pnpm test:e2e:ui       # interactive UI mode
pnpm test:e2e:report   # open the last HTML report
```

Requirements: a local `.env` with Supabase + database vars (same as `pnpm dev`)
when running locally, since authed pages hit Supabase and Postgres.

Not wired into CI yet — it needs the test-account secrets and a reachable
backend; add as a separate GitHub Actions job when ready.
