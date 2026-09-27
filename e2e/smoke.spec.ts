import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILE, DEMO_SLUG } from "./global-setup";

const APP_PAGES = [
  "/app",
  "/app/guests",
  "/app/rsvp",
  "/app/seating",
  "/app/budget",
  "/app/vendors",
  "/app/venues",
  "/app/hotels",
  "/app/travel",
  "/app/inspiration",
  "/app/website",
  "/app/tasks",
  "/app/schedule",
  "/app/settings",
];

const PUBLIC_PAGES = ["/", "/login", "/r", `/w/${DEMO_SLUG}`, `/rsvp/${DEMO_SLUG}`];

/** Opens a page and checks the things every page must get right. */
async function checkPage(page: Page, path: string) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`JavaScript error: ${e.message}`));
  page.on("console", (m) => {
    // React/Next dev warnings aren't failures; real errors are
    if (m.type() === "error" && !/Download the React DevTools|\[Fast Refresh\]/.test(m.text()))
      problems.push(`console: ${m.text().slice(0, 300)}`);
  });

  const response = await page.goto(path, { waitUntil: "networkidle" });
  expect(response?.status(), `${path} should load`).toBeLessThan(400);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

  // nothing should stick out sideways on a phone
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `${path} is wider than the screen`).toBeLessThanOrEqual(1);

  // automatic accessibility check (WCAG 2.1 A/AA); only serious problems fail the test
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = axe.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id}: ${v.help} (${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(" | ")})`,
    );
  expect(serious, `${path} accessibility`).toEqual([]);
  expect(problems, `${path} errors`).toEqual([]);
}

test.describe("public pages", () => {
  for (const path of PUBLIC_PAGES) {
    test(`opens ${path}`, async ({ page }) => {
      await checkPage(page, path);
    });
  }
});

test.describe("signed in", () => {
  test.use({ storageState: AUTH_FILE });

  for (const path of APP_PAGES) {
    test(`opens ${path}`, async ({ page }) => {
      await checkPage(page, path);
    });
  }

  test("searches the guest list", async ({ page }) => {
    await page.goto("/app/guests");
    await page.getByRole("searchbox").first().fill("Wright");
    // phones show a list instead of the (hidden) table, so look for the visible one
    await expect(
      page.getByRole("button", { name: "Emma Wright" }).filter({ visible: true }).first(),
    ).toBeVisible();
  });
});
