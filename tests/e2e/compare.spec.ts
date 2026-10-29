import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const COMPARE_KEY = "bhai.compare.v1";

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

// /analyze stays mounted (hidden) after a client navigation, with its own data-hydrated form.
const hydrated = (page: Page) => page.locator("#compare-view[data-hydrated]").waitFor();

/** Opens /compare and waits until the saved comparison has been read. */
async function openCompare(page: Page) {
  await page.goto("/compare");
  await hydrated(page);
}

const property = (overrides: Record<string, unknown> = {}) => ({
  bezirkCode: "01",
  ortsteilCode: "0102",
  address: null,
  propertyType: "apartment",
  areaM2: 65,
  rooms: 2.5,
  floor: 2,
  totalFloors: 5,
  buildingEra: "unknown",
  energyClass: "unknown",
  condition: "unknown",
  hasLift: null,
  hasBalcony: true,
  furnishing: "unfurnished",
  transitMinutes: null,
  ...overrides,
});

const THREE = [
  { id: "a1", label: "Turmstraße", property: property(), askingColdRent: 1150, listingUrl: "https://www.example.org/expose/1", source: "manual", addedAt: "2026-10-29T10:00:00.000Z" },
  { id: "b2", label: "Gesundbrunnen", property: property({ ortsteilCode: "0106", areaM2: 58, rooms: 2 }), askingColdRent: null, listingUrl: null, source: "analysis", addedAt: "2026-10-29T10:01:00.000Z" },
  { id: "c3", label: "Charlottenburg-Wilmersdorf, a long name that wraps", property: property({ bezirkCode: "04", ortsteilCode: "0401", areaM2: 82.5, rooms: 3 }), askingColdRent: 1490.5, listingUrl: null, source: "manual", addedAt: "2026-10-29T10:02:00.000Z" },
];

/** Writes the saved comparison, then reloads. Waits for the first read, or it would consume the seed. */
async function seed(page: Page, value: unknown) {
  await openCompare(page);
  await page.evaluate(([key, raw]) => localStorage.setItem(key!, raw!), [COMPARE_KEY, typeof value === "string" ? value : JSON.stringify(value)]);
  await page.reload();
  await hydrated(page);
}

const dialog = (page: Page) => page.getByRole("dialog");
// The phone arrangement adds label rows in the body, so read the property names from thead.
const columns = (page: Page) => page.getByRole("table").locator("thead").getByRole("columnheader");
// Value cells name their row in `headers`, in both the desktop and the phone arrangement.
const cells = (page: Page, row: string) => page.locator(`td[headers~="compare-row-${row}"]`);

async function fillRequired(scope: Locator, { bezirk, area, rooms }: { bezirk: string; area: string; rooms: string }) {
  await scope.getByRole("combobox", { name: /^Bezirk/ }).selectOption({ label: bezirk });
  await scope.getByRole("radio", { name: "Apartment" }).check();
  await scope.getByRole("textbox", { name: /^Living area/ }).fill(area);
  await scope.getByRole("textbox", { name: /^Rooms/ }).fill(rooms);
}

test.describe("/compare", () => {
  test("Flow 5: from an analysis to three properties, a replacement, a removal and a cleared comparison", async ({
    page,
  }) => {
    // Four adds, an edit and two removals: about 10 s alone, and three times that in a full parallel run.
    test.setTimeout(60_000);
    const errors = watchErrors(page);
    await page.goto("/analyze");
    await page.locator("form#analyze-form[data-hydrated]").waitFor();
    await fillRequired(page.locator("form#analyze-form"), { bezirk: "Mitte", area: "65", rooms: "2,5" });
    await page.getByRole("combobox", { name: /^Ortsteil/ }).selectOption({ label: "Moabit" });
    await page.getByRole("button", { name: "Prepare analysis" }).last().click();
    await page.getByRole("button", { name: "Add to comparison" }).click();
    await expect(page.getByRole("button", { name: "Added to comparison" })).toBeVisible();
    await page.getByRole("link", { name: "Open the comparison" }).click();

    await expect(page).toHaveURL(/\/compare$/);
    await hydrated(page);
    await expect(columns(page)).toHaveText([/^Moabit, 65\sm²$/]);
    // Added from the analysis: the asking rent is still empty, and the table says so.
    await expect(cells(page, "askingColdRent")).toContainText("Missing");
    await expect(cells(page, "rentPerM2")).toHaveText("Needs the asking rent");
    await expect(cells(page, "predicted")).toContainText("Model not connected");

    await page.getByRole("button", { name: /^Add the asking rent for Moabit/ }).click();
    await expect(dialog(page).getByRole("textbox", { name: /^Asking cold rent/ })).toBeFocused();
    await dialog(page).getByRole("textbox", { name: /^Asking cold rent/ }).fill("1.150");
    await dialog(page).getByRole("button", { name: "Save changes" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(cells(page, "askingColdRent")).toHaveText("€1,150 a month");
    await expect(cells(page, "rentPerM2")).toHaveText(/^€17\.69\s\/m²$/);
    await expect(columns(page).first()).toBeFocused();

    await page.reload();
    await hydrated(page);
    await expect(cells(page, "rentPerM2")).toHaveText(/^€17\.69\s\/m²$/);

    // Two more by hand: one with a link, one left to the default name.
    await page.getByRole("button", { name: "Add a property" }).click();
    await dialog(page).getByRole("textbox", { name: /^Name in the comparison/ }).fill("Kollwitzkiez, 3rd floor");
    await dialog(page).getByRole("textbox", { name: /^Asking cold rent/ }).fill("950,50");
    await dialog(page).getByRole("textbox", { name: /^Link to the listing/ }).fill("https://www.example.org/listing/1");
    await fillRequired(dialog(page), { bezirk: "Pankow", area: "58", rooms: "2" });
    await dialog(page).getByRole("button", { name: "Add to comparison" }).click();
    await expect(columns(page)).toHaveText([/^Moabit/, "Kollwitzkiez, 3rd floor"]);
    await expect(columns(page).nth(1)).toBeFocused();
    await expect(cells(page, "rentPerM2").nth(1)).toHaveText(/^€16\.39\s\/m²$/);
    const link = cells(page, "listing").nth(1).getByRole("link");
    await expect(link).toHaveText("example.org (new tab)");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noreferrer");

    await page.getByRole("button", { name: "Add a property" }).click();
    await fillRequired(dialog(page), { bezirk: "Neukölln", area: "48", rooms: "1,5" });
    await dialog(page).getByRole("button", { name: "Add to comparison" }).click();
    await expect(columns(page)).toHaveText([/^Moabit/, "Kollwitzkiez, 3rd floor", /^Neukölln, 48\sm²$/]);
    await expect(page.getByRole("complementary", { name: "Legend and sources" })).toContainText("3 of 3 places used.");
    await expect(page.locator("#compare-view > [aria-live]")).toHaveText(
      /^Added to comparison: Neukölln, 48\sm²\. 3 of 3 places used\.$/,
    );

    // A fourth has to replace one, and the dialog says so.
    await page.getByRole("button", { name: "Add a property" }).click();
    const replace = dialog(page).getByRole("group", { name: /^Which property does this one replace/ });
    await expect(replace).toContainText("The comparison holds up to 3 properties and is full.");
    await fillRequired(dialog(page), { bezirk: "Spandau", area: "70", rooms: "3" });
    await dialog(page).getByRole("button", { name: "Add to comparison" }).click();
    await expect(dialog(page).getByRole("region", { name: "Fix 1 field to add this property" })).toBeFocused();
    await dialog(page).getByRole("link", { name: "Choose the property this one replaces." }).click();
    await expect(replace.getByRole("radio").first()).toBeFocused();
    await replace.getByRole("radio", { name: "Kollwitzkiez, 3rd floor" }).check();
    await dialog(page).getByRole("button", { name: "Add to comparison" }).click();
    await expect(columns(page)).toHaveText([/^Moabit/, /^Spandau, 70\sm²$/, /^Neukölln/]);

    // Removing asks first.
    await page.getByRole("button", { name: /^Remove Neukölln/ }).click();
    await expect(dialog(page)).toHaveAccessibleName(/^Remove Neukölln, 48\sm²\?$/);
    await dialog(page).getByRole("button", { name: "Keep it" }).click();
    await expect(columns(page)).toHaveCount(3);
    await page.getByRole("button", { name: /^Remove Neukölln/ }).click();
    await dialog(page).getByRole("button", { name: "Remove the property" }).click();
    await expect(columns(page)).toHaveCount(2);
    await expect(page.getByRole("heading", { name: "How do your properties compare?" })).toBeFocused();

    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(dialog(page)).toHaveAccessibleName("Clear the comparison?");
    await dialog(page).getByRole("button", { name: "Clear the comparison" }).click();
    await expect(page.getByRole("heading", { name: "Add the properties you are weighing up" })).toBeFocused();
    expect(await page.evaluate((key) => localStorage.getItem(key), COMPARE_KEY)).toBe(JSON.stringify({ version: 1, items: [] }));
    expect(errors).toEqual([]);
  });

  test("rejects links that aren't http(s) and rents that aren't amounts", async ({ page }) => {
    await openCompare(page);
    await page.getByRole("button", { name: "Add a property" }).click();
    const url = dialog(page).getByRole("textbox", { name: /^Link to the listing/ });
    const rent = dialog(page).getByRole("textbox", { name: /^Asking cold rent/ });
    await fillRequired(dialog(page), { bezirk: "Mitte", area: "65", rooms: "2" });

    for (const value of ["javascript:alert(1)", "ftp://example.org/listing", "www.example.org/listing"]) {
      await url.fill(value);
      await dialog(page).getByRole("button", { name: "Add to comparison" }).click();
      await expect(url).toHaveAccessibleDescription(/Paste the listing's full web address, starting with https:\/\//);
    }
    await url.fill("https://example.org/listing");
    for (const [value, message] of [
      ["abc", /Enter the asking cold rent in euros/],
      ["0", /must be between €1 and €100,000/],
      ["1.15.0", /Enter the asking cold rent in euros/],
    ] as const) {
      await rent.fill(value);
      await dialog(page).getByRole("button", { name: "Add to comparison" }).click();
      await expect(rent).toHaveAccessibleDescription(message);
    }
    await rent.fill("1,150.50");
    await dialog(page).getByRole("button", { name: "Add to comparison" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(cells(page, "askingColdRent")).toHaveText("€1,150.50 a month");
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), COMPARE_KEY);
    expect(stored.items[0]).toMatchObject({ askingColdRent: 1150.5, listingUrl: "https://example.org/listing", source: "manual" });
  });

  test("closing the add dialog keeps the entries, and the analysis can fill it in", async ({ page }) => {
    await page.goto("/analyze");
    await page.locator("form#analyze-form[data-hydrated]").waitFor();
    await fillRequired(page.locator("form#analyze-form"), { bezirk: "Lichtenberg", area: "71", rooms: "3" });
    // The analysis draft lives in this tab's session storage, so it survives the navigation.
    await openCompare(page);

    await page.getByRole("button", { name: "Add a property" }).click();
    await dialog(page).getByRole("textbox", { name: /^Name in the comparison/ }).fill("Draft name");
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add a property" })).toBeFocused();

    await page.getByRole("button", { name: "Add a property" }).click();
    await expect(dialog(page).getByText("Your unsaved entries from before are still here.")).toBeVisible();
    await expect(dialog(page).getByRole("textbox", { name: /^Name in the comparison/ })).toHaveValue("Draft name");

    await dialog(page).getByRole("button", { name: "Fill in from your analysis" }).click();
    await expect(dialog(page).getByRole("textbox", { name: /^Asking cold rent/ })).toBeFocused();
    await expect(dialog(page).getByRole("combobox", { name: /^Bezirk/ }).locator("option:checked")).toHaveText("Lichtenberg");
    await expect(dialog(page).getByRole("textbox", { name: /^Living area/ })).toHaveValue("71");
    await dialog(page).getByRole("button", { name: "Add to comparison" }).click();
    await expect(columns(page)).toHaveText(["Draft name"]);
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), COMPARE_KEY);
    expect(stored.items[0]).toMatchObject({ label: "Draft name", source: "analysis", askingColdRent: null });

    // A saved add starts the next one empty.
    await page.getByRole("button", { name: "Add a property" }).click();
    await expect(dialog(page).getByText("Your unsaved entries from before are still here.")).toHaveCount(0);
    await expect(dialog(page).getByRole("textbox", { name: /^Name in the comparison/ })).toHaveValue("");
  });

  test("drops corrupt or old saved data and says so", async ({ page }) => {
    for (const value of ["{not json", { version: 0, items: [] }, { version: 1, items: [{ id: "x" }] }]) {
      await seed(page, value);
      const notice = page.getByText("The comparison saved in this browser couldn’t be read");
      await expect(notice).toBeVisible();
      await expect(page.getByRole("heading", { name: "Add the properties you are weighing up" })).toBeVisible();
      expect(await page.evaluate((key) => localStorage.getItem(key), COMPARE_KEY)).toBeNull();
      await page.getByRole("button", { name: "Dismiss" }).click();
      await expect(notice).toHaveCount(0);
    }
  });

  test("has no axe violations, empty, full and with the dialog open", async ({ page }) => {
    test.setTimeout(60_000); // three axe scans
    await openCompare(page);
    await expectNoAxeViolations(page);
    await seed(page, { version: 1, items: THREE });
    await expect(columns(page)).toHaveCount(3);
    await expectNoAxeViolations(page);
    await page.getByRole("button", { name: /^Edit Gesundbrunnen/ }).click();
    await dialog(page).getByRole("textbox", { name: /^Living area/ }).fill("");
    await dialog(page).getByRole("button", { name: "Save changes" }).click();
    await expect(dialog(page).getByRole("region", { name: /^Fix 1 field/ })).toBeFocused();
    await expectNoAxeViolations(page);
  });

  test("three properties fit a 360 px screen without horizontal scroll (F5)", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await seed(page, { version: 1, items: THREE });
    await expect(columns(page)).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    // Each column keeps at least a quarter of the screen.
    for (const box of await columns(page).evaluateAll((ths) => ths.map((th) => th.getBoundingClientRect().width))) {
      expect(box).toBeGreaterThanOrEqual(90);
    }
  });
});
