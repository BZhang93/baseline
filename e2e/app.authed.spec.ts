import { test, expect } from "./fixtures";

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

  // Scope to the per-event checkboxes inside the results list — the filter
  // controls above the list (e.g. "Hide events past my cutoff") are also
  // checkboxes, so a bare getByRole("checkbox").first() would toggle a filter
  // instead of selecting an event.
  const eventCheckboxes = page.locator("li input[type=checkbox]");
  const count = await eventCheckboxes.count();
  test.skip(count === 0, "No tournaments in this environment to select.");

  await eventCheckboxes.first().check();
  await expect(page.getByText(/\d+ selected/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create schedule from selection" }),
  ).toHaveAttribute("href", /\/schedules\/new\?events=/);
});
