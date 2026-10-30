import { expect, test } from "@playwright/test";

// Netlify adds a line break and a comment to <head> on *.netlify.app (see host-head-comment.ts):
// `<meta charset>\n<!-- ... -->`, with the next tag following the comment directly. This is the
// layout read from the live site. Without the head script, React 19 fails to hydrate (error #418).
const NETLIFY_COMMENT =
  "\n<!-- This site is hosted on Netlify. Anyone can build and deploy a site\n     like this one for free: https://netlify.new/ -->";

test("hydrates without error when the host adds its comment to <head>", async ({ page }) => {
  let injected = 0;
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    const original = await response.text();
    const body = original.replace('<meta charSet="utf-8"/>', `<meta charSet="utf-8"/>${NETLIFY_COMMENT}`);
    if (body !== original) injected++;
    await route.fulfill({ response, body });
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  for (const path of ["/", "/market", "/analyze"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    // The head script removed the comment before hydration.
    expect(await page.evaluate(() => [...document.head.childNodes].some((n) => n.nodeType === 8))).toBe(false);
  }
  expect(injected).toBe(3); // the comment really was served on every page
  expect(errors).toEqual([]);
});
