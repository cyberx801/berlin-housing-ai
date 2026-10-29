import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("app shell", () => {
  test("the skip link is the first tab stop and moves focus to main", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
  });

  test("marks the current page in the navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Berlin Housing AI" }).first()).toHaveAttribute("aria-current", "page");
  });

  test("mobile menu opens, closes with Escape and returns focus", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop-1440", "The menu button exists below 1024 px only");
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Menu" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const menu = page.locator("#mobile-menu");
    await expect(menu.getByRole("link", { name: "Explore" })).toBeVisible();

    await menu.getByRole("link", { name: "Explore" }).focus();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test("the not-found page explains and offers ways back", async ({ page }) => {
    const response = await page.goto("/neighborhoods-that-do-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "This page is not on the map" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to the start" })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });

  test("focus stays visible and clear of the sticky header", async ({ page }) => {
    await page.goto("/");
    // Tab backwards from the footer so the browser scrolls upward to each target.
    await page.getByRole("contentinfo").getByRole("link").last().focus();
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Shift+Tab");
      const obscured = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        const header = document.querySelector("header");
        if (!el || !header || header.contains(el)) return false;
        return el.getBoundingClientRect().bottom <= header.getBoundingClientRect().bottom;
      });
      expect(obscured).toBe(false);
    }
  });
});
