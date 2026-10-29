import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows the statement and the Ring Plate from official geometry (A1)", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Read a Berlin flat against its city." })).toBeVisible();
    const plate = page.getByRole("img", { name: "Berlin's 97 Ortsteile and the S-Bahn ring" });
    await expect(plate).toBeVisible();
    await expect(plate.locator("path[data-code]")).toHaveCount(97);
    await expect(page.getByText("Official data").first()).toBeVisible();
  });

  test("the select is a keyboard path to every Ortsteil (A2)", async ({ page }) => {
    const select = page.getByLabel("Find an Ortsteil");
    await expect(select.locator("option")).toHaveCount(98); // placeholder + 97
    await select.focus();
    await select.selectOption({ label: "Moabit" });

    const readout = page.locator("dl").filter({ hasText: "Ring status" }).first();
    await expect(readout).toContainText("Mitte");
    await expect(readout).toContainText("Partly inside the ring");
    await expect(page.getByRole("link", { name: "Open the Moabit profile" })).toHaveAttribute(
      "href",
      "/neighborhoods/moabit",
    );
    await expect(page.locator('use[href="#home-plate-o-0102"]')).toHaveCount(2); // marker fill + outline
  });

  test("tapping or clicking an Ortsteil selects it", async ({ page }) => {
    await page.locator('path[data-code="0910"]').click(); // Köpenick, large and outside the ring
    await expect(page.getByLabel("Find an Ortsteil")).toHaveValue("0910");
    await expect(page.locator("dl").filter({ hasText: "Ring status" }).first()).toContainText("Outside the ring");
  });

  test("the analysis entry validates like /analyze and carries values in the URL (A3)", async ({ page }) => {
    const entry = page.getByRole("region", { name: "Start an analysis" });
    await entry.getByRole("button", { name: "Continue to the full form" }).click();

    await expect(entry.getByText("Choose the Bezirk (borough) the flat is in.")).toBeVisible();
    await expect(entry.getByText("Enter the living area in m², for example 65.")).toBeVisible();
    await expect(entry.getByLabel("Bezirk (borough)")).toBeFocused();
    await expect(entry.getByLabel("Bezirk (borough)")).toHaveAttribute("aria-invalid", "true");

    await entry.getByLabel("Bezirk (borough)").selectOption({ label: "Mitte" });
    await entry.getByLabel("Living area").fill("65");
    await entry.getByLabel("Rooms").fill("2,5");
    await entry.getByRole("button", { name: "Continue to the full form" }).click();

    await page.waitForURL(/\/analyze\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get("bezirk")).toBe("mitte");
    expect(url.searchParams.get("area")).toBe("65");
    expect(url.searchParams.get("rooms")).toBe("2,5");
  });

  test("rejects out-of-range values with the shared messages", async ({ page }) => {
    const entry = page.getByRole("region", { name: "Start an analysis" });
    await entry.getByLabel("Bezirk (borough)").selectOption({ label: "Pankow" });
    await entry.getByLabel("Living area").fill("5");
    await entry.getByLabel("Rooms").fill("2.3");
    await entry.getByRole("button", { name: "Continue to the full form" }).click();
    await expect(entry.getByText("Living area must be between 10 and 500 m².")).toBeVisible();
    await expect(entry.getByText("Rooms go in steps of 0.5, for example 2.5.")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("Bezirk silhouettes link to the directory by slug (A5)", async ({ page }) => {
    const tiles = page
      .getByRole("region", { name: "Twelve Bezirke, one scale" })
      .getByRole("list")
      .getByRole("link");
    await expect(tiles).toHaveCount(12);
    await expect(tiles.filter({ hasText: "Treptow-Köpenick" })).toHaveAttribute(
      "href",
      "/neighborhoods?bezirk=treptow-koepenick",
    );
  });

  test("states what the data can and can't tell (A6)", async ({ page }) => {
    const truth = page.getByRole("region", { name: "What the data can and can’t tell you" });
    for (const label of ["Official data", "From your entries", "Demo data", "Not connected", "Not written yet"]) {
      await expect(truth.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test("has no horizontal scroll and no axe violations (A7)", async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });

  test("draws the ring once per session", async ({ page }) => {
    await expect(page.locator("html")).toHaveAttribute("data-ring-drawn", "", { timeout: 3000 });
    await page.reload();
    // The head script marks it before first paint, so the draw-in does not replay.
    const marked = await page.evaluate(() => document.documentElement.hasAttribute("data-ring-drawn"));
    expect(marked).toBe(true);
  });
});
