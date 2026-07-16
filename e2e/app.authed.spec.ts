import { test, expect } from "@playwright/test";

// Signed-in flows. These reuse the session captured in auth.setup.ts.

test("app shell navigates between the main sections", async ({ page }) => {
  await page.goto("/schedules");
  await expect(page.getByRole("heading", { name: "My Schedules" })).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: "Browse" }).click();
  await expect(page.getByRole("heading", { name: "Browse Tournaments" })).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: "Profile" }).click();
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
});

test("selecting events on Browse reveals the create-from-selection action", async ({
  page,
}) => {
  await page.goto("/browse");
  await expect(page.getByRole("heading", { name: "Browse Tournaments" })).toBeVisible();

  const checkboxes = page.getByRole("checkbox");
  const count = await checkboxes.count();
  test.skip(count === 0, "No tournaments in this environment to select.");

  await checkboxes.first().check();
  await expect(page.getByText(/\d+ selected/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create schedule from selection" }),
  ).toHaveAttribute("href", /\/schedules\/new\?events=/);
});
