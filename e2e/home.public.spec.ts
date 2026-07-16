import { test, expect } from "@playwright/test";

// Public (signed-out) flows — no backend account required.

test("landing page shows the product and a Get started CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Baseline" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
});

test("Get started routes to the login page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Get started" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign up" })).toBeVisible();
});

test("a protected route redirects to /login when signed out", async ({ page }) => {
  await page.goto("/schedules");
  await expect(page).toHaveURL(/\/login$/);
});
