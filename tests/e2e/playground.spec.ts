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
