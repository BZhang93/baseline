import { test as base, expect, type ConsoleMessage } from "@playwright/test";

// Shared test fixtures. `test` here extends the base with an automatic guard
// that fails any test which logs a browser `console.error` or throws an
// uncaught exception in the page — so a broken/regressed page can't pass
// silently (hydration mismatches, thrown effects, missing data, etc.).
//
// We intentionally do NOT assert on failed network requests: those are noisier
// (cancelled/aborted requests, optional third-party calls) and would flake.
export const test = base.extend<{ failOnConsoleError: void }>({
  failOnConsoleError: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = [];
      const onConsole = (msg: ConsoleMessage) => {
        if (msg.type() === "error") errors.push(msg.text());
      };
      const onPageError = (err: Error) => errors.push(`pageerror: ${err.message}`);

      page.on("console", onConsole);
      page.on("pageerror", onPageError);

      await use();

      page.off("console", onConsole);
      page.off("pageerror", onPageError);

      // Only assert when the test otherwise passed — don't mask the real failure.
      if (testInfo.status === testInfo.expectedStatus) {
        expect(
          errors,
          `Unexpected browser console errors:\n${errors.join("\n")}`,
        ).toEqual([]);
      }
    },
    { auto: true },
  ],
});

export { expect };
