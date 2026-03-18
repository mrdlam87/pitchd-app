import { test as setup } from "@playwright/test";
import path from "path";

const sessionFile = path.join(__dirname, ".auth/session.json");

/**
 * Saves a logged-in browser session to e2e/.auth/session.json.
 * Runs once before the test suite via the "setup" project in playwright.config.ts.
 *
 * Because auth uses Google OAuth (no password form), this setup opens the
 * sign-in page and waits up to 3 minutes for you to complete sign-in manually.
 * Once you're redirected away from /sign-in the session is saved automatically.
 *
 * Run once: npx playwright test --project=setup --headed
 * Subsequent runs reuse the saved session automatically.
 */
setup("authenticate", async ({ page }) => {
  setup.setTimeout(180_000);

  await page.goto("/sign-in");

  console.log("\n👉  Complete Google sign-in in the browser window (you have 3 minutes)...");

  // Wait until we land on a protected page — not sign-in and not an auth callback route
  await page.waitForURL(
    (url) => !url.pathname.includes("sign-in") && !url.pathname.includes("/api/auth"),
    { timeout: 180_000 }
  );

  await page.context().storageState({ path: sessionFile });
  console.log("✅  Session saved to", sessionFile);
});
