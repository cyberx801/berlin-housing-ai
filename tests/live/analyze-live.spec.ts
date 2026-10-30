import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Runs against the demo model built into the server, through the proxy route (playwright.live.config.ts).
// The model is the demo model trained on synthetic data (D-058): every figure must sit under
// the demo band and the fixed words, and none may leak into the title or the meta text.

test("Analyze → the demo model answers under the demo band", async ({ page }) => {
  await page.goto("/analyze");
  await page.locator("form#analyze-form[data-hydrated]").waitFor();

  await page.getByRole("combobox", { name: /^Bezirk/ }).selectOption({ label: "Mitte" });
  await page.getByRole("combobox", { name: /^Ortsteil/ }).selectOption({ label: "Moabit" });
  await page.getByRole("radio", { name: "Apartment" }).check();
  await page.getByRole("textbox", { name: /^Living area/ }).fill("65");
  await page.getByRole("textbox", { name: /^Rooms/ }).fill("2,5");
  await page.getByRole("textbox", { name: /^Floor/ }).fill("2");
  await page.getByRole("textbox", { name: /^Total floors/ }).fill("5");
  await page.getByRole("group", { name: /^Balcony/ }).getByRole("radio", { name: "Yes" }).check();
  await page.getByRole("button", { name: "Prepare analysis" }).last().click();

  const heading = page.getByRole("heading", { name: "Demo estimate of the cold rent" });
  await expect(heading).toBeFocused({ timeout: 15_000 });
  const result = page.getByRole("region", { name: "Demo estimate of the cold rent" });

  await expect(result).toContainText("Demo model, trained on synthetic data. Not a Berlin market estimate.");
  await expect(result).toContainText("Demo model");
  await expect(result).not.toContainText("Model estimate");
  await expect(result.locator(".band-hatch").first()).toBeVisible();
  await expect(result).toContainText(/€\s?[\d,]+/);
  await expect(result).toContainText(/Range at the 80\s?% level/);
  await expect(result).toContainText("kaggle-berlin-5csv (synthetic)");
  await expect(result).toContainText("Sent, but this model does not use them: Property type.");
  await expect(result).toContainText("Training data ends");

  await result.getByText("What moved the estimate").click();
  await expect(result).toContainText("Location (Ortsteil)");
  // LIVE_SHOT_DIR=<folder> keeps one full-panel screenshot per width for the design review.
  if (process.env.LIVE_SHOT_DIR) {
    await result.screenshot({ path: `${process.env.LIVE_SHOT_DIR}/live-result-${test.info().project.name}.png` });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // The figure stays out of anything a crawler or a share preview reads.
  await expect(page).not.toHaveTitle(/€/);
  const meta = await page.locator('head meta[name="description"], head meta[property^="og:"]').evaluateAll((els) =>
    els.map((el) => el.getAttribute("content") ?? ""),
  );
  expect(meta.join(" ")).not.toMatch(/€/);

  // The interval is ordered around the point estimate.
  const text = (await result.innerText()).replace(/\s/g, " ");
  const figures = [...text.matchAll(/€([\d,]+)/g)].map((m) => Number(m[1]?.replace(/,/g, "")));
  expect(figures.length).toBeGreaterThanOrEqual(3);
  const [point, lower, upper] = figures as [number, number, number];
  expect(lower).toBeLessThanOrEqual(point);
  expect(point).toBeLessThanOrEqual(upper);

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});

test("A flat with most fields left open still gets an answer, with the assumptions listed", async ({ page }) => {
  await page.goto("/analyze");
  await page.locator("form#analyze-form[data-hydrated]").waitFor();
  await page.getByRole("combobox", { name: /^Bezirk/ }).selectOption({ label: "Neukölln" });
  await page.getByRole("radio", { name: "Apartment" }).check();
  await page.getByRole("textbox", { name: /^Living area/ }).fill("48");
  await page.getByRole("textbox", { name: /^Rooms/ }).fill("2");
  await page.getByRole("button", { name: "Prepare analysis" }).last().click();

  await expect(page.getByRole("heading", { name: "Demo estimate of the cold rent" })).toBeFocused({ timeout: 15_000 });
  await expect(page.getByRole("region", { name: "Demo estimate of the cold rent" })).toContainText(
    "Not given, so the model filled them in",
  );
});

test("The pages say the rent model is a demo, not that it is missing", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Pages on this site" })).toContainText("try the demo rent model");
  await expect(page.getByText("Demo model, synthetic data").first()).toBeVisible();
  await expect(page.getByText("Rent model not connected")).toHaveCount(0);
  await expect(page.getByText("Rent model: not connected")).toHaveCount(0);
  await page.goto("/methodology");
  await expect(page.getByText("Prediction engine not connected")).toHaveCount(0);
  await expect(page.getByText("No rent model is connected")).toHaveCount(0);
  await page.goto("/compare");
  await expect(page.getByText("still being built")).toHaveCount(0);
  await expect(page.getByText("Model not connected")).toHaveCount(0);
});
