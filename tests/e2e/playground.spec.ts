import { expect, test } from "@playwright/test";

test("playground rolls notation without switching the active tab", async ({
  page,
}) => {
  await page.goto("/playground");
  const notation = page.getByLabel("Notation", { exact: true });
  const roll = page.getByRole("button", { name: "Roll dice", exact: true });
  const visual = page.getByRole("tab", { name: "Visual", exact: true });
  const text = page.getByRole("tab", { name: "Text", exact: true });
  const data = page.getByRole("tab", { name: "Data", exact: true });
  const result = page
    .getByRole("tabpanel", { name: "Text" })
    .getByRole("status");

  await expect(visual).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("button", { name: "D6", exact: true }),
  ).toBeEnabled();
  for (const tab of ["Visual", "Text", "Data", "Code"]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await expect(
      page.getByRole("tabpanel", { name: tab }).getByText("No rolls yet"),
    ).toBeVisible();
  }
  await visual.click();

  await notation.fill("2d6+");
  await roll.click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("No rolls yet")).toBeVisible();

  await notation.fill("2d6+3");
  await roll.click();
  await expect(visual).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("No rolls yet")).toHaveCount(0);
  await text.click();
  await expect(result).toHaveText(
    /^2d6\+3:\s*\[[1-6],\s*[1-6]\]\s*\+\s*3\s*=\s*(?:[5-9]|1[0-5])$/,
  );

  await data.click();
  await notation.fill("d20");
  await notation.press("Enter");
  await expect(data).toHaveAttribute("aria-selected", "true");
  await text.click();
  await expect(result).toHaveText(/^d20:/);

  await notation.fill("2+3");
  await roll.click();
  await expect(text).toHaveAttribute("aria-selected", "true");
  await expect(result).toHaveText(/^2\+3:.*= 5$/);
});

test("playground reports library errors and retains the last successful roll", async ({
  page,
}) => {
  await page.goto("/playground");
  const notation = page.getByLabel("Notation", { exact: true });
  const text = page.getByRole("tab", { name: "Text", exact: true });
  await text.click();
  await notation.fill("d6");
  await notation.press("Enter");
  const result = page
    .getByRole("tabpanel", { name: "Text" })
    .getByRole("status");
  await expect(result).toHaveText(/^d6:/);
  const previous = await result.textContent();

  for (const invalid of ["2d6+", "", "d20+$missing", "sqrt(-1)"]) {
    await notation.fill(invalid);
    await notation.press("Enter");
    await expect(page.getByRole("alert")).not.toBeEmpty();
    await expect(notation).toHaveAttribute("aria-invalid", "true");
    await expect(result).toHaveText(previous!);
    await expect(text).toHaveAttribute("aria-selected", "true");
  }

  await notation.fill("d8");
  await notation.press("Enter");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(result).toHaveText(/^d8:/);
});

for (const width of [320, 1280]) {
  test(`configuration collapses at ${width}px without submitting a roll`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/playground");
    const panel = page.getByRole("region", { name: "Configuration" });
    const collapse = panel.getByRole("button", {
      name: "Collapse configuration",
    });
    const expand = panel.getByRole("button", {
      name: "Expand configuration",
    });
    const settings = panel.getByLabel("Presenter", { exact: true });

    await expect(settings).toBeVisible();
    await expect(collapse).toHaveAttribute("aria-expanded", "true");
    await collapse.click();
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    await expect(settings).toBeHidden();
    await expect(page.getByText("No rolls yet")).toBeVisible();
    await expect(expand).toBeFocused();
    await expand.press("Enter");
    await expect(settings).toBeVisible();
    await expect(collapse).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("No rolls yet")).toBeVisible();
  });
}

test("quick dice replace notation and roll without switching tabs", async ({
  page,
}) => {
  await page.goto("/playground");
  const notation = page.getByLabel("Notation", { exact: true });
  const visual = page.getByRole("tab", { name: "Visual", exact: true });
  const text = page.getByRole("tab", { name: "Text", exact: true });
  const result = page
    .getByRole("tabpanel", { name: "Text" })
    .getByRole("status");

  await notation.fill("2d6+");
  await notation.press("Enter");
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "D6", exact: true }).click();
  await expect(notation).toHaveValue("d6");
  await expect(visual).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await text.click();
  await expect(result).toHaveText(/^d6: \[[1-6]\] = [1-6]$/);

  for (const die of ["D4", "D6", "D8", "D10", "D12", "D20", "D%", "DF"]) {
    const expected = `d${die.slice(1)}`;
    await page.getByRole("button", { name: die, exact: true }).click();
    await expect(notation).toHaveValue(expected);
    await expect(text).toHaveAttribute("aria-selected", "true");
    await expect(result).toHaveText(new RegExp(`^${expected}:`));
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
});

test("examples replace notation and immediately roll", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/playground");
  const notation = page.getByLabel("Notation", { exact: true });
  const examples = page.getByRole("button", { name: "Examples", exact: true });
  const data = page.getByRole("tab", { name: "Data", exact: true });
  const text = page.getByRole("tab", { name: "Text", exact: true });
  const result = page
    .getByRole("tabpanel", { name: "Text" })
    .getByRole("status");

  await data.click();
  await examples.press("Enter");
  await page.getByRole("menuitem", { name: /^Basic roll/ }).press("Enter");
  await expect(notation).toHaveValue("2d6+3");
  await expect(data).toHaveAttribute("aria-selected", "true");
  await text.click();
  await expect(result).toHaveText(/^2d6\+3:/);

  // Examples without data must work with the default roller configuration.
  await examples.click();
  const items = page.getByRole("menuitem").filter({
    hasNot: page.getByTestId("example-data-info"),
  });
  const count = await items.count();
  expect(count).toBe(16);
  await expect(page.getByTestId("example-data-info")).toHaveCount(3);
  await page.keyboard.press("Escape");

  for (let index = 0; index < count; index++) {
    await examples.click();
    const item = items.nth(index);
    const expected = await item
      .locator('[data-slot="itemDescription"]')
      .innerText();
    await item.click();
    await expect(notation).toHaveValue(expected);
    await expect(result).toContainText(`${expected}:`);
    await expect(text).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
});

test("variable examples show a warning without applying data", async ({
  page,
}) => {
  await page.goto("/playground");
  const notation = page.getByLabel("Notation", { exact: true });
  const examples = page.getByRole("button", { name: "Examples", exact: true });
  await examples.click();
  const attack = page.getByRole("menuitem", { name: /^Attack bonus/ });
  const info = attack.getByTestId("example-data-info");

  await expect(attack).toHaveAccessibleName(/overwrite existing variable data/);
  await info.hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "overwrite existing variable data",
  );
  await expect(notation).toHaveValue("4d6kh3 + 2");

  await info.click();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(notation).toHaveValue("4d6kh3 + 2");

  await attack.click({ position: { x: 8, y: 8 } });
  await expect(notation).toHaveValue("d20+$bonus");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("No rolls yet")).toBeVisible();
  await page.getByRole("button", { name: "Variables", exact: true }).click();
  await expect(page.getByLabel("Variables (JSON data)")).toHaveValue("{}");
});

test("result tabs display and copy JSON and plain text", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, "write", {
      value: async (items: ClipboardItem[]) => {
        const blob = await items[0]!.getType("text/plain");
        sessionStorage.setItem("copied-code", await blob.text());
      },
    });

    // VueUse falls back to a temporary textarea when clipboard permission
    // is unavailable (including in Firefox).
    const execCommand = document.execCommand.bind(document);
    document.execCommand = (command, ...args) => {
      if (command === "copy") {
        const textarea = document.querySelector<HTMLTextAreaElement>(
          "body > textarea[readonly]",
        );
        if (textarea) {
          sessionStorage.setItem("copied-code", textarea.value);
          return true;
        }
      }

      return execCommand(command, ...args);
    };
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/playground");
  const notation = page.getByLabel("Notation", { exact: true });
  const data = page.getByRole("tab", { name: "Data", exact: true });
  const panel = page.getByRole("tabpanel", { name: "Data" });
  const code = panel.locator("pre code");
  const copy = panel.getByRole("button", { name: "Copy JSON", exact: true });
  const full = panel.getByRole("button", { name: "Full", exact: true });
  const concise = panel.getByRole("button", { name: "Concise", exact: true });

  await data.click();
  await expect(panel.getByText("No rolls yet")).toBeVisible();
  await notation.fill("2+3");
  await notation.press("Enter");
  await expect(code).toContainText('"notation": "2+3"');
  await expect(code.locator("span[style]")).not.toHaveCount(0);
  await expect(full).toHaveAttribute("aria-pressed", "true");
  await expect(concise).toHaveAttribute("aria-pressed", "false");

  const exported = (await code.textContent())!;
  const parsed = JSON.parse(exported);
  expect(parsed).toMatchObject({
    type: "roll",
    version: 1,
    notation: "2+3",
    total: 5,
  });
  expect(parsed.result.node).toBeDefined();
  expect(exported).toBe(JSON.stringify(parsed, null, 2));
  await copy.click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("copied-code")))
    .toBe(exported);
  await expect(data).toHaveAttribute("aria-selected", "true");

  await concise.click();
  await expect(concise).toHaveAttribute("aria-pressed", "true");
  await expect(full).toHaveAttribute("aria-pressed", "false");
  const conciseData = JSON.stringify({ notation: "2+3", rolls: [] }, null, 2);
  await expect(code).toHaveText(conciseData);
  await copy.click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("copied-code")))
    .toBe(conciseData);
  await full.click();
  await expect(code).toHaveText(exported);
  await concise.click();

  await notation.fill("d20");
  await notation.press("Enter");
  await expect(code).toContainText('"notation": "d20"');
  await expect(concise).toHaveAttribute("aria-pressed", "true");
  const previous = await code.textContent();
  const conciseRoll = JSON.parse(previous!);
  expect(conciseRoll.rolls[0][0]).toBeGreaterThanOrEqual(1);
  expect(conciseRoll.rolls[0][0]).toBeLessThanOrEqual(20);
  await full.click();
  await expect(code).toContainText('"type": "roll"');
  expect(JSON.parse((await code.textContent())!).total).toBe(
    conciseRoll.rolls[0][0],
  );
  await concise.click();
  await expect(code).toHaveText(previous!);
  await notation.fill("d20+");
  await notation.press("Enter");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(code).toHaveText(previous!);
  await expect(data).toHaveAttribute("aria-selected", "true");

  await page.getByRole("tab", { name: "Text", exact: true }).click();
  const textPanel = page.getByRole("tabpanel", { name: "Text" });
  const textCode = textPanel.locator("pre code");
  await expect(textCode).toHaveText(/^d20:/);
  await expect(textCode.locator("span")).toHaveCount(0);
  const textOutput = await textCode.textContent();
  await textPanel
    .getByRole("button", { name: "Copy text", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("copied-code")))
    .toBe(textOutput);
});
