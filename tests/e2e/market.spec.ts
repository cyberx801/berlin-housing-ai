import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const DEMO = "Demo data, not Berlin market statistics";

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    // Prefetches of routes built in later slices answer 404; everything else counts.
    if (message.type() === "error" && !message.text().includes("404")) errors.push(message.text());
  });
  return errors;
}

const moduleById = (page: Page, id: string) => page.locator(`#${id}`);
const scope = (page: Page, id: string) => moduleById(page, id).locator("[data-module-scope]");

/** Every module has its answer for the current filters. */
async function settled(page: Page) {
  await expect(page.locator('[data-module-status="loading"]')).toHaveCount(0);
  await expect(page.locator("[data-module-status]")).toHaveCount(4);
}

/** Waits until a link's filters have been applied (the static HTML shows the defaults). */
async function open(page: Page, url: string, trendScope: string) {
  await page.goto(url);
  await expect(scope(page, "market-trend")).toHaveText(trendScope);
  await settled(page);
}

test.describe("/market", () => {
  test("Flow 4: read the dashboard, filter it, and keep the filters in the link", async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, "/market", "All of Berlin, all property types, 2020 to 2025.");
    await expect(page.getByRole("heading", { level: 1, name: "Market dashboard" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: DEMO })).toBeVisible();
    // Every module is labeled demo in its band and inside its SVG.
    await expect(page.locator('[data-provenance-stamp="demo"]')).toHaveCount(4);
    await expect(page.getByRole("link", { name: "How this is calculated" }).first()).toHaveAttribute(
      "href",
      "/methodology#market-data",
    );

    // Choosing Bezirke and a type updates the modules and the URL.
    await page.getByRole("checkbox", { name: "Mitte" }).check();
    await page.getByRole("checkbox", { name: "Pankow" }).check();
    await page.getByLabel("Property type", { exact: true }).selectOption("apartment");
    await page.getByLabel("From", { exact: true }).selectOption("2023");
    await expect(page).toHaveURL(/\/market\?bezirke=mitte%2Cpankow&from=2023&type=apartment$/);
    await settled(page);
    await expect(scope(page, "market-trend")).toHaveText("Mitte and Pankow, apartments, 2023 to 2025.");
    await expect(scope(page, "market-distribution")).toHaveText("Mitte and Pankow combined, apartments, 2023 to 2025.");
    await expect(moduleById(page, "market-trend").getByRole("list", { name: "Lines" })).toContainText("Pankow");
    await expect(page.locator("p[aria-live]")).toHaveText("Charts show Mitte and Pankow, apartments, 2023 to 2025.");

    // The link restores the same view.
    await page.reload();
    await expect(scope(page, "market-trend")).toHaveText("Mitte and Pankow, apartments, 2023 to 2025.");
    await expect(page.getByRole("checkbox", { name: "Pankow" })).toBeChecked();
    await expect(page.getByLabel("Property type", { exact: true })).toHaveValue("apartment");

    // The table view is always available.
    const trend = moduleById(page, "market-trend");
    await trend.getByText("Show table").click();
    await expect(trend.getByRole("table")).toBeVisible();
    await expect(trend.getByRole("columnheader", { name: "Pankow" })).toBeVisible();
    await expect(trend.locator("caption")).toContainText(DEMO);

    await page.getByRole("button", { name: "Reset filters" }).first().click();
    await expect(page).toHaveURL(/\/market$/);
    expect(errors).toEqual([]);
  });

  test("refuses a fifth Bezirk with the reason", async ({ page }) => {
    await open(page, "/market?bezirke=mitte,pankow,spandau,neukoelln", "Mitte, Pankow, Spandau and Neukölln, all property types, 2020 to 2025.");
    const fifth = page.getByRole("checkbox", { name: "Lichtenberg" });
    await expect(fifth).toHaveAttribute("aria-disabled", "true");
    // It stays operable (and in the tab order), so the reason can be found.
    await fifth.focus();
    await page.keyboard.press("Space");
    await expect(page.getByText("Up to 4 Bezirke can be compared at once. Clear one to add Lichtenberg.")).toBeVisible();
    await expect(fifth).not.toBeChecked();
    // The link was never rewritten (it was valid), so it keeps its literal commas.
    await expect(page).toHaveURL(/\/market\?bezirke=mitte,pankow,spandau,neukoelln$/);
  });

  test("shows the empty state for a combination without demo series, with a reset", async ({ page }) => {
    await open(page, "/market?bezirke=spandau&type=penthouse", "Spandau, penthouses, 2020 to 2025.");
    const trend = moduleById(page, "market-trend");
    await expect(trend.getByRole("heading", { name: "No demo series for this combination" })).toBeVisible();
    await trend.getByRole("button", { name: "Show all property types" }).click();
    await expect(page).toHaveURL(/\/market\?bezirke=spandau$/);
    await settled(page);
    await expect(trend.getByRole("slider")).toBeVisible();
  });

  test("reads chart values from the keyboard", async ({ page }) => {
    await open(page, "/market", "All of Berlin, all property types, 2020 to 2025.");
    const slider = moduleById(page, "market-trend").getByRole("slider");
    await slider.focus();
    await page.keyboard.press("Home");
    await expect(slider).toHaveAttribute("aria-valuetext", /^January 2020: €\d+\.\d\d/);
    await page.keyboard.press("ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuetext", /^February 2020: /);
    // The visual readout follows the keyboard.
    await expect(moduleById(page, "market-trend").locator("[data-chart-tooltip]")).toContainText("February 2020");
  });

  test("answers bad API queries with 400 and a reason", async ({ request }) => {
    const response = await request.get("/api/market/rent-trend?bezirke=01,02,03,04,05");
    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_QUERY" } });
  });

  test("has no horizontal scroll and no axe violations, with filters and an empty state", async ({ page }) => {
    await open(page, "/market", "All of Berlin, all property types, 2020 to 2025.");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    await expectNoAxeViolations(page);
    await open(page, "/market?bezirke=spandau,mitte&type=penthouse", "Spandau and Mitte, penthouses, 2020 to 2025.");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    await expectNoAxeViolations(page);
  });
});
