import { test as setup, expect } from "@playwright/test";
import path from "node:path";

// Logs in through the real login form and persists the Supabase session so the
// `authed` project can start already signed in. Credentials come from env so no
// secrets live in the repo:
//   E2E_EMAIL=... E2E_PASSWORD=... pnpm test:e2e
const authFile = path.join(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Set E2E_EMAIL and E2E_PASSWORD (a test account) to run authenticated e2e tests. " +
        "Public specs (*.public.spec.ts) run without them.",
    );
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();

  // A successful login redirects to /schedules.
  await page.waitForURL("**/schedules");
  await expect(page.getByRole("heading", { name: "My Schedules" })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
