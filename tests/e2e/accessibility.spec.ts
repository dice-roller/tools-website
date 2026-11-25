import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function audit(page: Page) {
  // Audit the entire page, including open menus and teleported overlays.
  await page.evaluate(() => document.fonts.ready);
  const { violations } = await new AxeBuilder({ page })
    .withTags(wcagTags)
    .analyze();

  expect(
    violations,
    JSON.stringify(
      violations.map(({ id, impact, nodes }) => ({
        id,
        impact,
        nodes: nodes.map(({ target, failureSummary }) => ({
          target,
          failureSummary,
        })),
      })),
      null,
      2,
    ),
  ).toEqual([]);
}

async function openHomepage(page: Page, colorScheme: "light" | "dark") {
  await page.emulateMedia({ colorScheme });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(new RegExp(colorScheme));
  // The colour mode control is rendered on the client; wait for hydration.
  await expect(
    page.getByRole("button", { name: /switch to (light|dark) mode/i }),
  ).toBeVisible();
}

for (const mode of ["light", "dark"] as const) {
  test.describe(`${mode} colour mode`, () => {
    test("homepage meets automated WCAG A/AA rules", async ({ page }) => {
      await openHomepage(page, mode);
      const hero = page.locator(".home-hero");
      await expect(hero).toBeVisible();
      // Ensure the decorative background is bundled and actually loads.
      expect(
        await hero.evaluate(async (element) => {
          const background = getComputedStyle(element).backgroundImage;
          const url = background.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
          if (!url) return false;
          const image = new Image();
          image.src = url;
          await image.decode();
          return image.naturalWidth > 0;
        }),
      ).toBe(true);
      await audit(page);
    });

    test("desktop Tools dropdown is keyboard accessible", async ({ page }) => {
      await openHomepage(page, mode);
      const trigger = page.getByRole("button", { name: "Tools", exact: true });
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(
        page.getByRole("link", { name: /AST explorer/ }),
      ).toBeVisible();
      await audit(page);
      await page.keyboard.press("Escape");
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(trigger).toBeFocused();
    });

    test("mobile menu meets automated WCAG A/AA rules", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await openHomepage(page, mode);
      await audit(page);
      await page
        .getByRole("button", { name: "Open menu", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("link", { name: "AST explorer" }),
      ).toBeVisible();
      await audit(page);
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
    });
  });
}

test("keyboard users can bypass the header", async ({ page }) => {
  await openHomepage(page, "light");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});

test("colour mode can be changed with the keyboard", async ({ page }) => {
  await openHomepage(page, "light");
  const toggle = page.getByRole("button", { name: "Switch to dark mode" });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(
    page.getByRole("button", { name: "Switch to light mode" }),
  ).toBeFocused();
});

test("homepage reflows at a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await openHomepage(page, "light");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});
