import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { legacyExample } from "../../app/data/converter-example";

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
      await expect(page.locator(".home-hero")).toBeVisible();
      const artwork = page.locator(".home-hero-artwork");
      // Ensure the decorative background is bundled and actually loads.
      expect(
        await artwork.evaluate(async (element) => {
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

    test("desktop tool links are keyboard accessible", async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 800 });
      await openHomepage(page, mode);
      const nav = page.getByRole("navigation", { name: "Main navigation" });
      const links = nav.getByRole("link");
      await expect(links).toHaveText([
        "Data converter",
        "Dice playground",
        /AST explorer.*Planned/,
      ]);
      const ast = nav.getByRole("link", { name: /AST explorer/ });
      await expect(ast).toHaveAttribute("href", /#ast$/);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(1024);
      await audit(page);
      await nav
        .getByRole("link", { name: "Data converter", exact: true })
        .press("Enter");
      await expect(page).toHaveURL(/\/converter\/?$/);
      await ast.press("Enter");
      await expect(page).toHaveURL(/#ast$/);
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
        dialog.getByRole("link", { name: "Data converter", exact: true }),
      ).toBeVisible();
      await expect(
        dialog.getByRole("link", { name: /AST explorer.*Planned/ }),
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

    test("conversion results and feedback meet automated WCAG rules", async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: mode });
      await page.goto("/converter");
      await expect(page.locator("html")).toHaveClass(new RegExp(mode));
      const input = page.getByRole("textbox", { name: "Data to convert" });
      const submit = page.getByRole("button", { name: "Convert data" });
      const form = page.getByRole("form", { name: "Conversion options" });
      // Audit the settled state, not a partially transparent animation frame.
      await page.emulateMedia({ reducedMotion: "reduce" });

      await submit.click();
      await expect(
        page.getByText("Enter some exported dice roller data."),
      ).toBeVisible();
      await audit(page);

      await input.fill("{invalid");
      await submit.click();
      await expect(form.getByRole("alert")).toContainText("Conversion failed");
      await audit(page);

      await page.getByRole("button", { name: "Load example" }).click();
      await submit.click();
      await expect(
        form.getByRole("status", { name: "Conversion status" }),
      ).toContainText("Conversion complete.");
      await audit(page);

      await input.fill(JSON.stringify({ ...legacyExample, total: 8 }));
      await page.getByRole("switch", { name: "Strict conversion" }).click();
      await submit.click();
      await expect(
        form.getByRole("status", { name: "Conversion status" }),
      ).toContainText("Conversion complete with warnings.");
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
      const command = page.locator("pre").filter({ hasText: "npm install" });
      await expect(command).toBeVisible();
      expect(
        await command.evaluate((element) => element.scrollWidth),
      ).toBeLessThanOrEqual(
        await command.evaluate((element) => element.clientWidth),
      );
      await audit(page);
    });
  });
}

test("converter is reachable from the homepage", async ({ page }) => {
  await openHomepage(page, "light");
  const card = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Data converter", exact: true }),
  });
  await expect(card).not.toContainText(/coming soon|planned|preview/i);
  const playground = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Dice playground", exact: true }),
  });
  await expect(playground).not.toContainText(/coming soon|planned/i);
  await page
    .getByRole("link", { name: "Open data converter", exact: true })
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

test("converter links to its library and installation instructions", async ({
  page,
}) => {
  await page.goto("/converter");
  const documentationBaseUrl =
    process.env.NUXT_PUBLIC_DOCUMENTATION_BASE_URL ??
    "https://dice-roller.github.io/documentation/";
  const library = page.getByRole("region", {
    name: "Use the converter in your own project",
  });
  await expect(library.locator("pre code")).toHaveText(
    "npm install @dice-roller/convertor",
  );
  await expect(
    library.getByRole("link", { name: "Converter documentation" }),
  ).toHaveAttribute(
    "href",
    new URL(
      "guide/packages/converter",
      `${documentationBaseUrl.replace(/\/+$/, "")}/`,
    ).href,
  );
  await expect(
    library.getByRole("link", { name: "View on GitHub" }),
  ).toHaveAttribute("href", "https://github.com/dice-roller/convertor");
});

test("documentation links use the configured base URL", async ({ page }) => {
  const url =
    process.env.NUXT_PUBLIC_DOCUMENTATION_BASE_URL ??
    "https://dice-roller.github.io/documentation/";
  await openHomepage(page, "light");
  await expect(
    page.getByRole("link", { name: "Read the docs", exact: true }),
  ).toHaveAttribute("href", url);
  await expect(
    page
      .getByRole("banner")
      .getByRole("link", { name: "Documentation", exact: true }),
  ).toHaveAttribute("href", url);
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Documentation" }),
  ).toHaveAttribute("href", url);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "Documentation" }),
  ).toHaveAttribute("href", url);
});

test("shared GitHub links point to the Dice Roller organisation", async ({
  page,
}) => {
  await openHomepage(page, "light");
  await expect(
    page.getByRole("link", { name: "Dice Roller on GitHub", exact: true }),
  ).toHaveAttribute("href", "https://github.com/dice-roller");
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "GitHub" }),
  ).toHaveAttribute("href", "https://github.com/dice-roller");
});

for (const mode of ["light", "dark"] as const) {
  test(`playground preview reflows and is accessible in ${mode} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: mode });
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/playground");
    await expect(
      page.getByRole("heading", { name: "Dice playground", exact: true }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveClass(new RegExp(mode));
    await expect(
      page.getByRole("button", { name: "Roll dice", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    await audit(page);
    const examples = page.getByRole("button", {
      name: "Examples",
      exact: true,
    });
    await examples.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await audit(page);
    await page.keyboard.press("Escape");
    const configuration = page.getByRole("button", {
      name: "Configuration",
      exact: true,
    });
    const dialog = page.getByRole("dialog", {
      name: "Configuration",
      exact: true,
    });
    const done = dialog.getByRole("button", { name: "Done", exact: true });
    await configuration.click();
    await expect(dialog).toBeVisible();
    await audit(page);
    await dialog
      .getByRole("button", { name: "Presenter options", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Flag symbols", exact: true })
      .click();
    await expect(dialog.getByLabel("Drop", { exact: true })).toBeVisible();
    await audit(page);
    const back = dialog.getByRole("button", {
      name: "Back to configuration",
      exact: true,
    });
    const options = dialog.getByRole("button", {
      name: "Presenter options",
      exact: true,
    });
    await back.click();
    await expect(options).toBeFocused();
    const presenter = dialog.getByLabel("Presenter", { exact: true });
    await presenter.click();
    await page.getByRole("option", { name: "SVG", exact: true }).click();
    await expect(presenter).toHaveAttribute("aria-expanded", "false");
    await expect(
      page.getByRole("listbox", { includeHidden: true }),
    ).toHaveCount(0);
    await options.click();
    await expect(back).toBeFocused();
    await expect(dialog.getByLabel("Dice size", { exact: true })).toBeVisible();
    await audit(page);
    await dialog
      .getByRole("button", { name: "Pick stroke colour", exact: true })
      .click();
    const colourPicker = page.getByRole("dialog", {
      name: "Pick stroke colour",
    });
    await expect(colourPicker).toBeVisible();
    await audit(page);
    await colourPicker
      .getByRole("button", { name: "Done", exact: true })
      .click();
    await expect(colourPicker).toBeHidden();
    await back.click();
    await expect(options).toBeFocused();
    await presenter.click();
    await page.getByRole("option", { name: "Text", exact: true }).click();
    await expect(presenter).toHaveAttribute("aria-expanded", "false");
    await expect(
      page.getByRole("listbox", { includeHidden: true }),
    ).toHaveCount(0);
    await done.click();
    await expect(dialog).toBeHidden();

    const notation = page.getByLabel("Notation", { exact: true });
    await notation.fill("2d6+3");
    await notation.press("Enter");
    await page.getByRole("tab", { name: "Text", exact: true }).click();
    await expect(
      page.getByRole("tabpanel", { name: "Text" }).getByRole("status"),
    ).toContainText("2d6+3:");
    const preview = page.getByRole("button", {
      name: "Preview roll 1: 2d6+3",
      exact: true,
    });
    await preview.press("Enter");
    await expect(preview).toHaveAttribute("aria-pressed", "true");
    await audit(page);
    const share = page.getByRole("button", { name: "Share", exact: true });
    await share.press("Enter");
    const shareDialog = page.getByRole("dialog", { name: "Share Playground" });
    await expect(
      shareDialog.getByRole("textbox", { name: "Share link" }),
    ).toHaveValue(/#play=v2\./);
    await audit(page);
    await page.keyboard.press("Escape");
    await expect(shareDialog).toBeHidden();
    await expect(share).toBeFocused();
    await page
      .getByRole("button", { name: "About Average", exact: true })
      .press("Enter");
    await expect(page.getByRole("tooltip")).toContainText("statistical mean");
    await audit(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toBeHidden();

    await page.getByRole("tab", { name: "Code", exact: true }).click();
    await expect(
      page.getByRole("tabpanel", { name: "Code" }).locator("pre code"),
    ).toContainText("const result = new Roll");
    await audit(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);

    await page.getByRole("tab", { name: "Data", exact: true }).click();
    const code = page
      .getByRole("tabpanel", { name: "Data" })
      .locator("pre code");
    await expect(code).toContainText('"notation": "2d6+3"');
    await expect(code.locator("span[style]")).not.toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    await audit(page);

    await notation.fill("2d6+");
    await notation.press("Enter");
    await expect(page.getByRole("alert")).toBeVisible();
    await audit(page);

    await configuration.click();
    await page
      .getByRole("button", { name: "Roll limits", exact: true })
      .click();
    const quantity = page.getByRole("textbox", {
      name: "Maximum dice quantity",
      exact: true,
    });
    await quantity.fill("0");
    await done.click();
    await notation.fill("d6");
    await notation.press("Enter");
    await expect(quantity).toHaveAttribute("aria-invalid", "true");
    await audit(page);
    await quantity.fill("999");
    await page.getByLabel("Random engine", { exact: true }).click();
    await page
      .getByRole("option", { name: "Mersenne Twister", exact: true })
      .click();
    const seed = page.getByRole("textbox", { name: "Seed", exact: true });
    await seed.fill("invalid");
    await done.click();
    await notation.press("Enter");
    await expect(seed).toHaveAttribute("aria-invalid", "true");
    await audit(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
  });
}

for (const mode of ["light", "dark"] as const) {
  test(`playground artwork opacity is isolated in ${mode} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: mode });
    await page.goto("/playground");
    await expect(page.locator("html")).toHaveClass(new RegExp(mode));
    await expect(page.locator("html")).toHaveCSS("opacity", "1");
    await expect(page.locator(".playground-artwork")).toHaveCSS(
      "opacity",
      mode === "light" ? "0.23" : "0.75",
    );
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator("html")).toHaveCSS("opacity", "1");
  });
}

test("playground links to the configured notation guide", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/playground");
  const documentationBaseUrl =
    process.env.NUXT_PUBLIC_DOCUMENTATION_BASE_URL ??
    "https://dice-roller.github.io/documentation/";
  const guide = page.getByRole("link", {
    name: "Notation guide (opens in a new tab)",
  });
  await expect(guide).toBeVisible();
  await expect(guide).toHaveAttribute(
    "href",
    new URL("guide/notation/", `${documentationBaseUrl.replace(/\/+$/, "")}/`)
      .href,
  );
  await expect(guide).toHaveAttribute("target", "_blank");
  await expect(page.getByLabel("Notation", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "About Notation", exact: true }),
  ).toBeVisible();
});
