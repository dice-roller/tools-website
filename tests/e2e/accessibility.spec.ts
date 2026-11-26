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

for (const mode of ["light", "dark"] as const) {
  test.describe(`converter in ${mode} mode`, () => {
    test("converter layout meets automated WCAG A/AA rules", async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: mode });
      await page.goto("/converter");
      await expect(
        page.getByRole("heading", { name: "Data converter", exact: true }),
      ).toBeVisible();
      await expect(page.locator("html")).toHaveClass(new RegExp(mode));
      await expect(
        page.getByRole("button", { name: /switch to (light|dark) mode/i }),
      ).toBeVisible();
      await audit(page);

      const info = page.getByRole("button", { name: "About Output format" });
      await info.focus();
      const tooltip = page.getByRole("tooltip");
      await expect(tooltip).toContainText(
        "Full preserves historical statistics",
      );
      await audit(page);
      await page.keyboard.press("Escape");
      await expect(tooltip).toBeHidden();
      await expect(info).toBeFocused();

      const select = page.getByLabel("Output format", { exact: true });
      await select.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("option", { name: "Concise" })).toBeVisible();
      await audit(page);
      await page.keyboard.press("Escape");
      await expect(select).toBeFocused();

      const inputEncoding = page.getByLabel("Input encoding", { exact: true });
      await inputEncoding.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("option", { name: "Base64" })).toBeVisible();
      await audit(page);
      await page.keyboard.press("Escape");
      await expect(inputEncoding).toBeFocused();

      const options = page.getByRole("button", {
        name: "Supported formats and conversion options",
      });
      await options.focus();
      await page.keyboard.press("Enter");
      await expect(options).toHaveAttribute("aria-expanded", "true");
      await audit(page);
    });

    test("converter reflows at 320px", async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.emulateMedia({ colorScheme: mode });
      await page.goto("/converter");
      await expect(
        page.getByRole("heading", { name: "Data converter", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(320);
      await audit(page);
    });
  });
}

test("converter preview is reachable from the homepage", async ({ page }) => {
  await openHomepage(page, "light");
  await page
    .getByRole("link", { name: "Preview data converter", exact: true })
    .click();
  await expect(page).toHaveURL(/\/converter\/?$/);
  const form = page.getByRole("form", { name: "Conversion options" });
  await expect(form).toBeVisible();
  for (const label of [
    "Target version",
    "Output format",
    "Encoding",
    "Data to convert",
    "Source version",
    "Input encoding",
  ]) {
    await expect(form.getByLabel(label, { exact: true })).toBeVisible();
  }
  await expect(
    form.getByRole("switch", { name: "Strict conversion" }),
  ).toBeVisible();
  await expect(
    form.getByRole("button", { name: "Convert data" }),
  ).toHaveAttribute("type", "submit");
  await expect(
    page.getByRole("button", { name: "Convert data" }),
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: "Upload file" })).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Load example" }),
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: "Copy" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Download" })).toBeDisabled();
  await expect(
    page.getByLabel("Input encoding", { exact: true }),
  ).toContainText("Auto-detect");
  await expect(
    page.getByRole("textbox", { name: "Data to convert" }),
  ).toBeEditable();
  const strict = page.getByRole("switch", { name: "Strict conversion" });
  await expect(strict).toBeChecked();
  await strict.focus();
  await page.keyboard.press("Space");
  await expect(strict).not.toBeChecked();
});

test("converter selectors use library capabilities", async ({ page }) => {
  await page.goto("/converter");
  const source = page.getByLabel("Source version", { exact: true });
  const target = page.getByLabel("Target version", { exact: true });
  const format = page.getByLabel("Output format", { exact: true });
  const encoding = page.getByLabel("Encoding", { exact: true });
  const menu = (name: string) =>
    page.getByRole("listbox", { name, exact: true });
  const option = (field: string, name: string) =>
    menu(field).getByRole("option", { name, exact: true });

  await expect(target).toContainText("Schema 1 (v6)");
  await format.click();
  await option("Output format", "Concise").click();
  await expect(format).toContainText("Concise");
  await expect(menu("Output format")).toBeHidden();

  await source.click();
  await option("Source version", "Legacy (v5)").click();
  await expect(menu("Source version")).toBeHidden();
  await target.click();
  await option("Target version", "Legacy (v5)").click();
  await expect(menu("Target version")).toBeHidden();
  await expect(format).toContainText("Full");
  await format.click();
  await expect(menu("Output format")).toBeVisible();
  await expect(option("Output format", "Full")).toBeVisible();
  await expect(option("Output format", "Concise")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(menu("Output format")).toBeHidden();

  await source.click();
  await option("Source version", "Schema 1 (v6)").click();
  await expect(menu("Source version")).toBeHidden();
  await expect(target).toContainText("Schema 1 (v6)");
  await target.click();
  await expect(option("Target version", "Latest supported")).toBeVisible();
  await expect(option("Target version", "Legacy (v5)")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(menu("Target version")).toBeHidden();

  await encoding.click();
  await expect(option("Encoding", "JSON")).toBeVisible();
  await expect(option("Encoding", "Base64")).toBeVisible();
  await expect(option("Encoding", "Object")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(menu("Encoding")).toBeHidden();

  const inputEncoding = page.getByLabel("Input encoding", { exact: true });
  await expect(inputEncoding).toContainText("Auto-detect");
  await inputEncoding.click();
  await expect(option("Input encoding", "Auto-detect")).toBeVisible();
  await expect(option("Input encoding", "JSON")).toBeVisible();
  await expect(option("Input encoding", "Object")).toHaveCount(0);
  await option("Input encoding", "Base64").click();
  await expect(inputEncoding).toContainText("Base64");
  await expect(encoding).toContainText("JSON");
});

test("converter field help is available without changing values", async ({
  page,
}) => {
  await page.goto("/converter");
  for (const label of [
    "Target version",
    "Output format",
    "Output encoding",
    "Strict conversion",
    "Data to convert",
    "Source version",
    "Input encoding",
  ]) {
    await expect(
      page.getByRole("button", { name: `About ${label}`, exact: true }),
    ).toBeVisible();
  }

  const strict = page.getByRole("switch", { name: "Strict conversion" });
  const info = page.getByRole("button", { name: "About Strict conversion" });
  await expect(strict).toBeChecked();
  await info.click();
  await expect(page.getByRole("tooltip")).toContainText("Reject ambiguous");
  await expect(strict).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toBeHidden();
});
