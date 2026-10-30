import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

const contents = (page: Page) => page.getByRole("navigation", { name: "On this page" });

/** The section heading for a hash, once it is in view and clear of the sticky site header. */
async function expectSectionInView(page: Page, id: string) {
  const heading = page.locator(`#methodology-${id}-title`);
  await expect(heading).toBeInViewport();
  await expect
    .poll(() =>
      page.evaluate((target) => {
        const header = document.querySelector("header")!.getBoundingClientRect().bottom;
        return document.getElementById(target)!.getBoundingClientRect().top - header;
      }, `methodology-${id}-title`),
    )
    .toBeGreaterThanOrEqual(0);
}

test.describe("/methodology", () => {
  test("Flow 6: opens on its contents, and every entry lands on its section", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/methodology");
    await expect(page.getByRole("heading", { level: 1, name: "Methodology" })).toBeVisible();

    const links = contents(page).getByRole("link");
    const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    expect(hrefs.length).toBeGreaterThanOrEqual(9);
    // The contents come first: the first link on the page after the site's own navigation.
    const firstMainLink = await page.locator("main a").first().getAttribute("href");
    expect(firstMainLink).toBe(hrefs[0]);

    for (const href of hrefs) {
      await contents(page).locator(`a[href="${href}"]`).click();
      await expect(page).toHaveURL(new RegExp(`/methodology${href}$`));
      await expectSectionInView(page, href.slice(1));
    }
    expect(errors).toEqual([]);
  });

  test("mirrors the capability table and lists every dataset", async ({ page }) => {
    await page.goto("/methodology");
    const table = page.getByRole("table", { name: /What exists in this phase/ });
    await expect(table.getByRole("rowheader")).toHaveText([
      "Bezirk and Ortsteil boundaries, names, areas, neighbors and ring status",
      "Market figures: rent trends, €/m² by Bezirk, price spreads and property types",
      "The Kaggle dataset (5 CSV files)",
      "Rent prediction",
      "Transit access for each Ortsteil",
      "Listings you compare and flats you describe",
      "Descriptions of what each neighborhood is like",
    ]);
    await expect(table.getByRole("row").filter({ hasText: "Rent prediction" })).toContainText("Not connected");

    const sources = page.getByRole("region", { name: "Data sources and licenses" });
    await expect(sources.getByRole("heading", { level: 3 })).toHaveText([
      "ALKIS Berlin Bezirke",
      "ALKIS Berlin Ortsteile",
      "Umweltzone Berlin",
      "Kaggle dataset (5 CSV files)",
      "Demo market fixtures",
    ]);
    await expect(sources.getByText(/^[0-9a-f]{64}$/)).toHaveCount(3);

    // Integrity: no euro amount anywhere on the page; the ring thresholds come from the shared constants.
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/€\s?\d/);
    expect(text).not.toMatch(/AI-powered/i);
    await expect(page.getByRole("region", { name: "Ring status" })).toContainText(/at least 95\s%/);
  });

  test("links from other pages land on their sections", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "How ring status is measured" }).click();
    await expect(page).toHaveURL(/\/methodology#ring$/);
    await expectSectionInView(page, "ring");

    await page.getByRole("contentinfo").getByRole("link", { name: "Full dataset registry" }).click();
    await expect(page).toHaveURL(/\/methodology#sources$/);
    await expectSectionInView(page, "sources");

    await page.goto("/market");
    await page.locator(`a[href="/methodology#market-data"]`).first().click();
    await expect(page).toHaveURL(/\/methodology#market-data$/);
    await expectSectionInView(page, "market-data");
  });

  test("its ids stay unique while other routes are kept mounted", async ({ page }) => {
    await page.goto("/");
    // The footer's links are client-side and visible at every width, unlike the header's.
    const footer = page.getByRole("navigation", { name: "Footer" });
    for (const name of ["Analyze", "Explore", "Neighborhoods", "Compare", "Market", "Methodology"]) {
      await footer.getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${name.toLowerCase()}$`));
    }
    await expect(page.getByRole("heading", { level: 1, name: "Methodology" })).toBeVisible();
    const hrefs = await contents(page).getByRole("link").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    for (const href of hrefs) {
      expect(await page.locator(`[id="${href.slice(1)}"]`).count(), href).toBe(1);
    }
  });

  test("has no axe violations and no horizontal scroll at 360 px", async ({ page }) => {
    await page.goto("/methodology");
    await expectNoAxeViolations(page);
    await page.setViewportSize({ width: 360, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  });
});
