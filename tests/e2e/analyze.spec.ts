import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

const hydratedForm = (page: Page) => page.locator("form#analyze-form[data-hydrated]");

/** Opens a URL and waits until the form is hydrated: React drops submits that come earlier. */
async function open(page: Page, url: string) {
  await page.goto(url);
  await hydratedForm(page).waitFor();
}

const submit = (page: Page) => page.getByRole("button", { name: "Prepare analysis" }).last();
const textbox = (page: Page, name: RegExp) => page.getByRole("textbox", { name });

test.describe("/analyze", () => {
  test("Flow 1: homepage entry → prefilled form → not-connected result", async ({ page }) => {
    await page.goto("/");
    const entry = page.getByRole("region", { name: "Start an analysis" });
    await entry.getByLabel("Bezirk (borough)").selectOption({ label: "Mitte" });
    await entry.getByLabel("Living area").fill("65");
    await entry.getByLabel("Rooms").fill("2,5");
    await entry.getByRole("button", { name: "Continue to the full form" }).click();

    // The link's values are applied once and then dropped from the URL (a reload keeps edits).
    await page.waitForURL(/\/analyze$/);
    await hydratedForm(page).waitFor();
    await expect(page.getByRole("heading", { level: 1, name: "Describe the flat" })).toBeVisible();
    await expect(page.getByText("Filled in from the link: Bezirk, living area, rooms.")).toBeVisible();
    await expect(page.getByRole("combobox", { name: /^Bezirk/ }).locator("option:checked")).toHaveText("Mitte");
    await expect(textbox(page, /^Rooms/)).toHaveValue("2,5");

    // Focus is on the first required field still empty; the keyboard picks the type.
    const apartment = page.getByRole("radio", { name: "Apartment" });
    await expect(apartment).toBeFocused();
    await page.keyboard.press("Space");
    await expect(apartment).toBeChecked();

    await page.getByRole("combobox", { name: /^Ortsteil/ }).selectOption({ label: "Moabit" });
    await textbox(page, /^Floor/).fill("2");
    await textbox(page, /^Total floors/).fill("5");
    await page.getByRole("group", { name: /^Balcony/ }).getByRole("radio", { name: "Yes" }).check();
    await submit(page).click();

    await expect(page.getByRole("heading", { name: "Prediction engine not connected" })).toBeFocused();
    const result = page.getByRole("region", { name: "Prediction engine not connected" });
    await expect(result).toContainText("Nothing was sent anywhere.");
    await expect(result).not.toContainText("€");
    await expect(result).toContainText("Moabit, Mitte");
    await result.getByText("Show the request the model will receive (JSON)").click();
    await expect(result.locator("code")).toContainText('"ortsteil": "Moabit"');
    await expect(result.locator("code")).toContainText('"has_balcony": true');
    await expect(result.getByRole("link", { name: "Open the Moabit profile" })).toHaveAttribute(
      "href",
      "/neighborhoods/moabit",
    );
    await expectNoAxeViolations(page);

    await result.getByRole("button", { name: "Add to comparison" }).click();
    await expect(result.getByRole("button", { name: "Added to comparison" })).toBeVisible();
    await expect(result.getByRole("status")).toContainText("1 of 3 places used");
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("bhai.compare.v1") ?? "null"));
    expect(stored.items).toHaveLength(1);
    expect(stored.items[0].askingColdRent).toBeNull();
  });

  test("an empty submit focuses the error summary, whose links focus the fields (B4)", async ({ page }) => {
    await open(page, "/analyze");
    // Visiting the type radios without choosing must not leave a raw value behind.
    await page.getByRole("radio", { name: "Apartment" }).focus();
    await page.keyboard.press("Tab");
    await submit(page).click();

    const summary = page.getByRole("region", { name: "Fix 4 fields to prepare the analysis" });
    await expect(summary).toBeFocused();
    await expect(summary).toContainText("Choose the property type.");
    await expect(summary).not.toContainText("expected");
    await expectNoAxeViolations(page);

    await summary.getByRole("link", { name: "Enter the living area in m², for example 65." }).click();
    await expect(textbox(page, /^Living area/)).toBeFocused();
    await expect(textbox(page, /^Living area/)).toHaveAttribute("aria-invalid", "true");
  });

  test("invalid link values are left empty with a notice, never guessed", async ({ page }) => {
    await open(page, "/analyze?bezirk=mitte&area=abc&rooms=2");
    await expect(page.getByText("Left empty because the link’s value wasn’t valid: living area.")).toBeVisible();
    await expect(textbox(page, /^Living area/)).toHaveValue("");
    await expect(textbox(page, /^Rooms/)).toHaveValue("2");
  });

  test("a changed Bezirk clears an Ortsteil that no longer fits, and says so (B3)", async ({ page }) => {
    await open(page, "/analyze");
    await page.getByRole("combobox", { name: /^Ortsteil/ }).selectOption({ label: "Moabit" });
    await expect(page.getByRole("combobox", { name: /^Bezirk/ }).locator("option:checked")).toHaveText("Mitte");
    await page.getByRole("combobox", { name: /^Bezirk/ }).selectOption({ label: "Pankow" });
    await expect(page.getByRole("combobox", { name: /^Ortsteil/ })).toHaveValue("");
    await expect(page.locator("[aria-live=polite]").last()).toHaveText("Ortsteil cleared: Moabit is not in Pankow.");
  });

  test("edits survive a reload, and Start over asks before clearing (B6)", async ({ page }) => {
    await open(page, "/analyze?bezirk=mitte&area=65&rooms=2");
    await page.waitForURL(/\/analyze$/);
    await textbox(page, /^Living area/).fill("70");
    await page.reload();
    await hydratedForm(page).waitFor();
    await expect(textbox(page, /^Living area/)).toHaveValue("70");
    await expect(page.getByText("Restored your entries from earlier in this session.").first()).toBeVisible();

    const startOver = page.getByRole("button", { name: "Start over" }).last();
    await startOver.click();
    const dialog = page.getByRole("dialog", { name: "Start over?" });
    await expect(dialog).toBeVisible();
    await expectNoAxeViolations(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(startOver).toBeFocused();
    await expect(textbox(page, /^Living area/)).toHaveValue("70");

    await startOver.click();
    await dialog.getByRole("button", { name: "Clear the form" }).click();
    await expect(textbox(page, /^Living area/)).toHaveValue("");
    await page.reload();
    await hydratedForm(page).waitFor();
    await expect(textbox(page, /^Living area/)).toHaveValue("");
    await expect(page.getByText("Restored your entries from earlier in this session.")).toHaveCount(0);
  });

  test("focus is never hidden under the header or the progress strip (2.4.11)", async ({ page }) => {
    await open(page, "/analyze");
    await page.getByRole("button", { name: "Start over" }).last().focus();
    // Tab backwards so the browser scrolls up to each target, toward the sticky bars.
    for (let i = 0; i < 30; i += 1) {
      await page.keyboard.press("Shift+Tab");
      const state = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        const header = document.querySelector("header"); // the site header comes first in the DOM
        const strip = document.querySelector("[data-sticky-strip] > .sticky");
        if (!el || !header) return { done: true, hidden: false, what: "" };
        if (header.contains(el)) return { done: true, hidden: false, what: "" };
        if (strip?.contains(el)) return { done: false, hidden: false, what: "" };
        const stripRect = strip?.getBoundingClientRect();
        const cover = Math.max(
          header.getBoundingClientRect().bottom,
          stripRect && stripRect.height > 0 ? stripRect.bottom : 0,
        );
        const rect = el.getBoundingClientRect();
        return { done: false, hidden: rect.top < cover - 1, what: `${el.tagName}#${el.id} top=${rect.top} cover=${cover}` };
      });
      expect(state.hidden, state.what).toBe(false);
      if (state.done) break;
    }
  });

  test("has no horizontal scroll and no axe violations on first load", async ({ page }) => {
    await open(page, "/analyze");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });
});
