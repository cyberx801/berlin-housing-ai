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
    // Prefetches of routes built in later slices answer 404; everything else counts.
    if (message.type() === "error" && !message.text().includes("404")) errors.push(message.text());
  });
  return errors;
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

const count = (page: Page) => page.locator("#directory-count");
// The row header also holds the Bezirk name shown below md, so read the link text.
const rows = (page: Page) => page.getByRole("table").getByRole("rowheader").getByRole("link");

test.describe("/neighborhoods", () => {
  test("Flow 2: from a Bezirk silhouette to a profile, a neighbor and the map", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/");
    await page
      .getByRole("region", { name: "Twelve Bezirke, one scale" })
      .getByRole("link")
      .filter({ hasText: /^Mitte/ })
      .click();
    await expect(page).toHaveURL(/\/neighborhoods\?bezirk=mitte$/);
    await expect(count(page)).toHaveText("6 of 97 Ortsteile");

    // Moabit lies 83 % inside the ring, so it is "partly inside".
    await page.getByRole("radio", { name: "Partly inside" }).check();
    await expect(page).toHaveURL(/\/neighborhoods\?bezirk=mitte&ring=partly$/);
    await page.getByRole("searchbox", { name: "Search by name" }).fill("moa");
    await expect(rows(page)).toHaveText(["Moabit"]);
    await expect(page).toHaveURL(/\/neighborhoods\?bezirk=mitte&ring=partly&q=moa$/);

    await rows(page).filter({ hasText: "Moabit" }).click();
    await expect(page).toHaveURL(/\/neighborhoods\/moabit$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Moabit");
    await expect(page.getByText("An Ortsteil of Mitte", { exact: true })).toBeVisible();

    const facts = page.getByRole("region", { name: "What the official boundaries say about Moabit" });
    await expect(facts.getByText("Official data", { exact: true })).toBeVisible();
    await expect(facts.getByText("0102", { exact: true })).toBeVisible();
    await expect(facts.getByText(/^Partly inside the ring/)).toBeVisible();
    await expect(facts.getByRole("list", { name: "6 bordering Ortsteile" }).getByRole("link")).toHaveCount(6);

    const nearby = page.getByRole("region", { name: "How Moabit compares with the Ortsteile around it" });
    await expect(nearby.getByRole("rowheader")).toHaveCount(7);

    const market = page.getByRole("region", { name: "Is there market data for Moabit?" });
    await expect(market.getByText("Demo data, not Berlin market statistics")).toBeVisible();
    await expect(market.getByRole("link", { name: "See Mitte on the market dashboard" })).toHaveAttribute(
      "href",
      "/market?bezirke=mitte",
    );
    await expect(
      page.getByRole("region", { name: "How far is the nearest station from Moabit?" }).getByText("Not connected", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "What is Moabit like?" }).getByText("Not written yet", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Analyze a flat in Moabit" })).toHaveAttribute(
      "href",
      "/analyze?bezirk=mitte&ortsteil=moabit",
    );

    await facts.getByRole("link", { name: "Tiergarten" }).click();
    await expect(page).toHaveURL(/\/neighborhoods\/tiergarten$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tiergarten");

    await page.goBack();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Moabit");
    await page.getByRole("link", { name: "See Moabit on the map" }).click();
    await expect(page).toHaveURL(/\/explore\?o=moabit$/);
    await expect(page.locator("#explore-details-title")).toHaveText("Moabit");
    expect(errors).toEqual([]);
  });

  test("keeps the filters in the link when coming back from a profile", async ({ page }) => {
    await page.goto("/neighborhoods?ring=outside&q=dorf");
    await expect(count(page)).not.toHaveText("All 97 Ortsteile");
    const shown = await rows(page).allTextContents();
    expect(shown.length).toBeGreaterThan(0);
    await rows(page).first().click();
    await expect(page).toHaveURL(/\/neighborhoods\/[a-z-]+$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/neighborhoods\?ring=outside&q=dorf$/);
    await expect(rows(page)).toHaveText(shown);
  });

  test("a search typed just before leaving is still there on Back", async ({ page }) => {
    await page.goto("/neighborhoods");
    // Keys pressed before hydration are dropped (slice 9 pre-hydration item).
    await page.locator("#directory[data-hydrated]").waitFor();
    const box = page.getByRole("searchbox", { name: "Search by name" });
    // Faster than the 400 ms delay on writing the search to the URL.
    await box.pressSequentially("moa");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/neighborhoods\/moabit$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/neighborhoods\?q=moa$/);
    await expect(box).toHaveValue("moa");

    await box.fill("");
    await expect(page).toHaveURL(/\/neighborhoods$/);
    await box.pressSequentially("wedd");
    await rows(page).filter({ hasText: "Wedding" }).click();
    await expect(page).toHaveURL(/\/neighborhoods\/wedding$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/neighborhoods\?q=wedd$/);
    await expect(box).toHaveValue("wedd");
  });

  test("the empty state names the active filters and clears them", async ({ page }) => {
    await page.goto("/neighborhoods?bezirk=spandau&ring=inside");
    await expect(page.getByText("No Ortsteil matches these filters")).toBeVisible();
    await expect(page.getByText("Bezirk:")).toBeVisible();
    await expect(page.getByText("Ring status:")).toBeVisible();
    await expectNoAxeViolations(page);
    await page.getByRole("button", { name: "Clear all filters" }).click();
    await expect(count(page)).toHaveText("All 97 Ortsteile");
    await expect(page).toHaveURL(/\/neighborhoods$/);
    await expect(page.getByRole("searchbox", { name: "Search by name" })).toBeFocused();
  });

  test("an unknown profile answers 404 with a search box and the A–Z list", async ({ page, request }) => {
    for (let i = 0; i < 2; i += 1) {
      expect((await request.get("/neighborhoods/not-a-place")).status()).toBe(404);
    }
    const response = await page.goto("/neighborhoods/moabbit");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "This page is not on the map" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse all 97 Ortsteile, A–Z" })).toHaveAttribute(
      "href",
      "/neighborhoods",
    );
    await expectNoAxeViolations(page);

    await page.getByRole("searchbox", { name: "Search the Ortsteile by name" }).fill("moa");
    await page.getByRole("button", { name: "Find Ortsteile" }).click();
    await expect(page).toHaveURL(/\/neighborhoods\?q=moa$/);
    await expect(rows(page)).toHaveText(["Moabit"]);
  });

  test("the directory and profiles have no horizontal scroll or axe violations", async ({ page }) => {
    for (const path of ["/neighborhoods", "/neighborhoods/moabit", "/neighborhoods/mitte", "/neighborhoods/koepenick"]) {
      await page.goto(path);
      expect(await horizontalOverflow(page), path).toBeLessThanOrEqual(0);
      await expectNoAxeViolations(page);
    }
  });

  test("every Ortsteil in the directory has a profile that fits a phone", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-375", "One width is enough to walk all 97 profiles.");
    test.setTimeout(180_000);
    await page.goto("/neighborhoods");
    const links = rows(page);
    await expect(links).toHaveCount(97);
    const entries = await links.evaluateAll((anchors) =>
      anchors.map((a) => ({ name: a.textContent ?? "", href: a.getAttribute("href") ?? "" })),
    );
    for (const { name, href } of entries) {
      const response = await page.goto(href);
      expect(response?.status(), href).toBe(200);
      await expect(page.getByRole("heading", { level: 1 }), href).toHaveText(name);
      expect(await horizontalOverflow(page), href).toBeLessThanOrEqual(0);
    }
  });
});
