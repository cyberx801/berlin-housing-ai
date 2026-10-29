import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

const mapArea = (page: Page) => page.locator("[data-map-state]");

/** "placeholder" is the server state; anything else means the view has hydrated. */
async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(mapArea(page)).not.toHaveAttribute("data-map-state", "placeholder");
}

const mapReady = (page: Page) => expect(mapArea(page)).toHaveAttribute("data-map-state", "ready", { timeout: 20_000 });
const listbox = (page: Page) => page.getByRole("listbox", { name: "Ortsteile" });
const detailsHeading = (page: Page) => page.locator("#explore-details-title");
const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;

/** Text that only the lazily loaded map module contains. */
const MAP_MODULE_MARKER = "/vendor/maplibre-gl-worker-";

function watchScripts(page: Page) {
  const bodies: Promise<string>[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/_next/static/chunks/") && response.url().endsWith(".js")) {
      bodies.push(response.text().catch(() => ""));
    }
  });
  return async () => (await Promise.all(bodies)).some((body) => body.includes(MAP_MODULE_MARKER));
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

test.describe("/explore", () => {
  test("Flow 3: search, choose from the list by keyboard, and read the details", async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, "/explore");
    await expect(page.getByRole("heading", { level: 1, name: "Explore the 97 Ortsteile" })).toBeVisible();
    await expect(page.getByText("All 97 Ortsteile", { exact: true })).toBeVisible();

    const search = page.getByRole("searchbox", { name: "Search by name" });
    await search.fill("moab");
    await expect(page.getByText("1 of 97 Ortsteile", { exact: true })).toBeVisible();
    await search.press("ArrowDown");
    await expect(listbox(page)).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(detailsHeading(page)).toHaveText("Moabit");
    await expect(page).toHaveURL(/\/explore\?o=moabit&q=moab$/);
    const details = page.getByRole(isNarrow(page) ? "tabpanel" : "region", { name: isNarrow(page) ? "Details" : "Moabit" });
    await expect(details.getByText("Partly inside the ring")).toBeVisible();
    await expect(details.getByRole("link", { name: "Analyze a flat in Moabit" })).toHaveAttribute(
      "href",
      "/analyze?bezirk=mitte&ortsteil=moabit",
    );
    if (isNarrow(page)) {
      // The list tab hides, so focus moves to the details it switched to.
      await expect(page.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
      await expect(detailsHeading(page)).toBeFocused();
    } else {
      await expect(listbox(page)).toBeFocused();
    }

    await mapReady(page);
    await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
    await expectNoAxeViolations(page);
    expect(errors).toEqual([]);
  });

  test("a shared link opens the same view, and Esc closes the details", async ({ page }) => {
    await open(page, "/explore?o=moabit&bezirk=mitte&ring=partly");
    await expect(detailsHeading(page)).toHaveText("Moabit");
    if (isNarrow(page)) await page.getByRole("tab", { name: /^List/ }).click();
    await expect(page.getByRole("combobox", { name: "Bezirk (borough)" }).locator("option:checked")).toHaveText("Mitte");
    await expect(page.getByRole("radio", { name: "Partly inside" })).toBeChecked();
    await expect(listbox(page).getByRole("option", { name: /^Moabit/ })).toHaveAttribute("aria-selected", "true");

    await page.reload();
    await expect(mapArea(page)).not.toHaveAttribute("data-map-state", "placeholder");
    await expect(detailsHeading(page)).toHaveText("Moabit");

    await page.getByRole("button", { name: "Close" }).focus();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/explore\?bezirk=mitte&ring=partly$/);
    await expect(listbox(page)).toBeFocused();
  });

  test("an unknown place in the link is dropped and the visitor is told", async ({ page }) => {
    await open(page, "/explore?o=atlantis");
    await expect(page.getByText("This link’s Ortsteil couldn’t be matched, so it was left out.")).toBeVisible();
    await expect(page).toHaveURL(/\/explore$/);
  });

  test("choosing an Ortsteil on the map selects it", async ({ page }) => {
    await open(page, "/explore");
    await mapReady(page);
    await page.locator(".maplibregl-canvas").click();
    await expect(page).toHaveURL(/\/explore\?o=[a-z-]+$/);
    const slug = new URL(page.url()).searchParams.get("o")!;
    await expect(detailsHeading(page)).not.toHaveText("No Ortsteil chosen yet");
    if (isNarrow(page)) await expect(page.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("link", { name: /^Open the .+ profile$/ })).toHaveAttribute("href", `/neighborhoods/${slug}`);
    await mapReady(page);
    await expectNoAxeViolations(page);
  });

  test("filters by Bezirk, keep the URL in step, and leave no horizontal scroll", async ({ page }) => {
    await open(page, "/explore");
    await page.getByRole("combobox", { name: "Bezirk (borough)" }).selectOption({ label: "Mitte" });
    await expect(page.getByText("6 of 97 Ortsteile", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/explore\?bezirk=mitte$/);
    await page.getByRole("radio", { name: "Inside", exact: true }).check();
    await expect(page).toHaveURL(/\/explore\?bezirk=mitte&ring=inside$/);
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/explore$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  });

  test("without WebGL2 the plate stands in and the map module is never downloaded", async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        return type === "webgl2" ? null : (original as (...args: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof original;
    });
    const loadedMapModule = watchScripts(page);
    await open(page, "/explore");
    await expect(mapArea(page)).toHaveAttribute("data-map-state", "fallback");
    await expect(page.getByText("The interactive map needs WebGL2")).toBeVisible();
    await expect(page.getByRole("img", { name: "Berlin's 97 Ortsteile" })).toBeVisible();

    await page.locator('[data-code="0102"]').first().click({ force: true });
    await expect(detailsHeading(page)).toHaveText("Moabit");
    await expectNoAxeViolations(page);
    await page.waitForLoadState("networkidle");
    expect(await loadedMapModule()).toBe(false);
  });

  test("the map module loads after hydration, and survives leaving and coming back", async ({ page }) => {
    const loadedMapModule = watchScripts(page);
    await open(page, "/explore?o=moabit");
    await mapReady(page);
    expect(await loadedMapModule()).toBe(true);

    // Hidden routes stay mounted (D-027): the map is removed on leave and rebuilt on return,
    // and nothing writes /explore's query onto the other route.
    if (isNarrow(page)) {
      await page.getByRole("button", { name: "Menu" }).click();
    }
    await page.getByRole("link", { name: "Analyze", exact: true }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/analyze$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/explore\?o=moabit$/);
    await mapReady(page);
    await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
    await expect(detailsHeading(page)).toHaveText("Moabit");
  });
});
