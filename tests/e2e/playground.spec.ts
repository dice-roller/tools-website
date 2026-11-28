import { expect, test, type Locator, type Page } from "@playwright/test";
import { EngineRegistry, Roller } from "@dice-roller/rpg-dice-roller";

// Nuxt UI's select menu restores focus as its closing animation completes.
// Wait for the portalled listbox to unmount before editing another field.
async function waitForSelectMenuClosed(page: Page, trigger: Locator) {
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("listbox", { includeHidden: true })).toHaveCount(
    0,
  );
  await expect(trigger).toBeFocused();
}

async function selectMenuOption(page: Page, trigger: Locator, name: string) {
  await trigger.click();
  await page.getByRole("option", { name, exact: true }).click();
  await waitForSelectMenuClosed(page, trigger);
  await expect(trigger).toContainText(name);
}

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

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`desktop configuration collapses with the button and rail (${reducedMotion})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/playground");
    const panel = page.getByRole("region", {
      name: "Configuration",
      exact: true,
    });
    const collapse = page.getByRole("button", {
      name: "Collapse configuration",
    });
    const expand = page.getByRole("button", { name: "Expand configuration" });
    const settings = panel.getByLabel("Presenter", { exact: true });
    const rail = panel.locator('[data-slot="rail"]');
    const container = panel.locator('[data-slot="container"]');
    const result = page.getByRole("region", { name: "Roll result" });
    const width = () =>
      result.evaluate((el) => el.getBoundingClientRect().width);
    await expect(settings).toBeVisible();
    const initial = await width();
    await container.evaluate((el) => {
      el.addEventListener("transitionrun", (event) => {
        if ((event as TransitionEvent).propertyName === "width") {
          el.setAttribute("data-width-transition", "true");
        }
      });
    });
    await collapse.click();
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    await expect(settings).toBeHidden();
    await expect
      .poll(() => container.evaluate((el) => el.getBoundingClientRect().width))
      .toBe(0);
    await expect.poll(width).toBeGreaterThan(initial + 250);
    // The zero-width sidebar must not leave a flex gap beside the results.
    await expect
      .poll(async () => {
        const sidebarLeft = await panel.evaluate(
          (el) => el.getBoundingClientRect().left,
        );
        const resultLeft = await result.evaluate(
          (el) => el.getBoundingClientRect().left,
        );
        return resultLeft - sidebarLeft;
      })
      .toBeCloseTo(0, 1);
    await expect(expand).toBeFocused();
    if (reducedMotion === "no-preference") {
      await expect(container).toHaveAttribute("data-width-transition", "true");
    } else {
      await expect(container).not.toHaveAttribute(
        "data-width-transition",
        "true",
      );
    }

    await rail.click();
    await expect(collapse).toHaveAttribute("aria-expanded", "true");
    await expect(settings).toBeVisible();
    await expect.poll(width).toBeCloseTo(initial, 1);
    await rail.click();
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    await expand.press("Enter");
    await expect(settings).toBeVisible();
    await expect.poll(width).toBeCloseTo(initial, 1);
    await expect(page.getByText("No rolls yet")).toBeVisible();
  });
}

for (const width of [320, 640]) {
  test(`configuration uses a modal at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/playground");
    const trigger = page.getByRole("button", {
      name: "Configuration",
      exact: true,
    });
    const dialog = page.getByRole("dialog", {
      name: "Configuration",
      exact: true,
    });
    await expect(trigger).toBeVisible();
    await expect(page.getByLabel("Presenter", { exact: true })).toBeHidden();
    await trigger.click();
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("button", { name: "Variables", exact: true })
      .click();
    const variables = dialog.getByRole("textbox", {
      name: "Variables (JSON data)",
      exact: true,
    });
    await variables.fill('{"bonus": 4}');
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.getByText("No rolls yet")).toBeVisible();
    const notation = page.getByLabel("Notation", { exact: true });
    await notation.fill("$bonus+1");
    await notation.press("Enter");
    await page.getByRole("tab", { name: "Text", exact: true }).click();
    await expect(
      page.getByRole("tabpanel", { name: "Text" }).getByRole("status"),
    ).toHaveText(/^\$bonus\+1:.*= 5$/);

    await trigger.click();
    await expect(variables).toHaveValue('{"bonus": 4}');
    await variables.fill("{");
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await notation.press("Enter");
    await expect(dialog).toBeVisible();
    await expect(variables).toHaveAttribute("aria-invalid", "true");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(notation).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert")).toContainText(
      "Invalid variable data",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
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

test("variable examples warn and replace data before rolling", async ({
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
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Variables", exact: true }).click();
  const variables = page.getByRole("textbox", {
    name: "Variables (JSON data)",
    exact: true,
  });
  await expect(variables).toHaveValue(JSON.stringify({ bonus: 3 }, null, 2));

  const dataTab = page.getByRole("tab", { name: "Data", exact: true });
  await dataTab.click();
  const code = page.getByRole("tabpanel", { name: "Data" }).locator("pre code");
  await expect(code).toContainText('"notation": "d20+$bonus"');
  const first = JSON.parse((await code.textContent())!);
  expect(first.total).toBe(first.result.left.value + 3);

  await variables.fill('{"bonus": 7}');
  await notation.fill("$bonus+1");
  await notation.press("Enter");
  await expect(code).toContainText('"notation": "$bonus+1"');
  expect(JSON.parse((await code.textContent())!).total).toBe(8);

  await examples.click();
  await page.getByRole("menuitem", { name: /^Character attack/ }).click();
  await expect(variables).toHaveValue(
    JSON.stringify({ character: { attackBonus: 2 } }, null, 2),
  );
  await expect(code).toContainText('"notation": "d20+$character.attackBonus"');
  const second = JSON.parse((await code.textContent())!);
  expect(second.total).toBe(second.result.left.value + 2);

  await examples.click();
  await page.getByRole("menuitem", { name: /^Calculated quantity/ }).click();
  const expected = { bonus: 3, character: { attackBonus: 2 } };
  await expect(variables).toHaveValue(JSON.stringify(expected, null, 2));
  await expect(code).toContainText(
    '"notation": "(max($bonus+$character.attackBonus, 4))d10"',
  );
  expect(JSON.parse((await code.textContent())!).result.rolls).toHaveLength(5);

  await examples.click();
  await page.getByRole("menuitem", { name: /^Basic roll/ }).click();
  await expect(variables).toHaveValue(JSON.stringify(expected, null, 2));
  await expect(code).toContainText('"notation": "2d6+3"');

  await page.getByRole("button", { name: "D6", exact: true }).click();
  await expect(variables).toHaveValue(JSON.stringify(expected, null, 2));
  await expect(code).toContainText('"notation": "d6"');
  await expect(dataTab).toHaveAttribute("aria-selected", "true");
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

test("visual tab presents the stored roll with the selected presenter", async ({
  page,
}) => {
  await page.goto("/playground");
  const notation = page.getByLabel("Notation", { exact: true });
  const presenter = page.getByLabel("Presenter", { exact: true });
  const visual = page.getByRole("tab", { name: "Visual", exact: true });
  const panel = page.getByRole("tabpanel", { name: "Visual" });
  const text = page.getByRole("tab", { name: "Text", exact: true });

  await expect(presenter).toBeEnabled();
  await expect(presenter).toContainText("Text");
  await notation.fill("d6");
  await notation.press("Enter");
  await expect(panel.getByRole("status")).toHaveText(/^d6: \[[1-6]\] = [1-6]$/);
  const original = (await panel.getByRole("status").textContent())!.trim();

  await selectMenuOption(page, presenter, "SVG");
  const svg = panel.locator("svg.result-preview");
  await expect(svg).toBeVisible();
  const value = original.match(/= (\d+)$/)![1]!;
  await expect(svg.locator('g[data-die-type="standard"]')).toHaveAttribute(
    "data-value",
    value,
  );
  await expect(visual).toHaveAttribute("aria-selected", "true");

  await text.click();
  await expect(
    page.getByRole("tabpanel", { name: "Text" }).getByRole("status"),
  ).toHaveText(original);
  await visual.click();

  await selectMenuOption(page, presenter, "Text");
  await expect(svg).toHaveCount(0);
  await expect(panel.getByRole("status")).toHaveText(original);

  await selectMenuOption(page, presenter, "SVG");
  await notation.fill("d8");
  await notation.press("Enter");
  await expect(svg.locator('g[data-die-type="standard"]')).toHaveAttribute(
    "data-faces",
    "8",
  );
  await expect(visual).toHaveAttribute("aria-selected", "true");
});

test("configuration fields have accessible information tooltips", async ({
  page,
}) => {
  await page.goto("/playground");
  await page.getByLabel("Random engine", { exact: true }).click();
  await page
    .getByRole("option", { name: "Mersenne Twister", exact: true })
    .click();
  await page.getByRole("button", { name: "Variables", exact: true }).click();
  await page.getByRole("button", { name: "Roll limits", exact: true }).click();

  for (const label of [
    "Presenter",
    "Random engine",
    "Seed",
    "Variables (JSON data)",
    "Maximum dice quantity",
    "Maximum iterations",
    "Maximum generated rolls",
  ]) {
    const info = page.getByRole("button", {
      name: `About ${label}`,
      exact: true,
    });
    await info.focus();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toBeHidden();
    await expect(info).toBeFocused();
  }
  await expect(page.getByText("No rolls yet")).toBeVisible();
});

test("configuration accordions retain bottom padding when expanded", async ({
  page,
}) => {
  await page.goto("/playground");
  const panel = page.getByRole("region", { name: "Configuration" });

  for (const label of ["Presenter options", "Variables", "Roll limits"]) {
    const trigger = panel.getByRole("button", { name: label, exact: true });
    await trigger.click();
    const body = panel.locator(
      `[id="${await trigger.getAttribute("aria-controls")}"] [data-slot="body"]`,
    );
    await expect(body).toBeVisible();
    const padding = await body.evaluate((element) => {
      const accordion = element.closest('[data-slot="item"]')?.parentElement;
      if (!accordion) throw new Error("Missing accordion");
      return {
        bottom: getComputedStyle(element).paddingBottom,
        side: getComputedStyle(accordion).paddingLeft,
      };
    });
    expect(parseFloat(padding.bottom)).toBeGreaterThan(0);
    expect(padding.bottom).toBe(padding.side);
  }
});

test("invalid variable data is reported without replacing the last roll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 812 });
  await page.goto("/playground");
  const notation = page.getByLabel("Notation", { exact: true });
  await notation.fill("2+3");
  await notation.press("Enter");
  await page.getByRole("tab", { name: "Text", exact: true }).click();
  const result = page
    .getByRole("tabpanel", { name: "Text" })
    .getByRole("status");
  await expect(result).toHaveText(/^2\+3:.*= 5$/);

  await page.getByRole("button", { name: "Variables", exact: true }).click();
  const variables = page.getByRole("textbox", {
    name: "Variables (JSON data)",
    exact: true,
  });
  for (const invalid of ["{", "[]", "null", '{"bonus":"3"}']) {
    await variables.fill(invalid);
    await page.getByRole("button", { name: "Roll dice", exact: true }).click();
    await expect(variables).toHaveAttribute("aria-invalid", "true");
    await expect(notation).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert")).toHaveCount(2);
    await expect(
      page.getByRole("alert").filter({
        hasText: "Invalid variable data. Check the Variables section.",
      }),
    ).toBeVisible();
    await expect(result).toHaveText(/^2\+3:.*= 5$/);
  }

  await variables.fill('{"bonus":4,"active":true}');
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(notation).not.toHaveAttribute("aria-invalid", "true");
  await expect(variables).not.toHaveAttribute("aria-invalid", "true");
  await notation.fill("$bonus+$active");
  await notation.press("Enter");
  await expect(result).toHaveText(/^\$bonus\+\$active:.*= 5$/);
});

test("roll limits apply to new rolls without replacing the previous result", async ({
  page,
}) => {
  await page.goto("/playground");
  const notation = page.getByLabel("Notation", { exact: true });
  await page.getByRole("button", { name: "Roll limits", exact: true }).click();
  const quantity = page.getByRole("textbox", {
    name: "Maximum dice quantity",
    exact: true,
  });
  const iterations = page.getByRole("textbox", {
    name: "Maximum iterations",
    exact: true,
  });
  const generated = page.getByRole("textbox", {
    name: "Maximum generated rolls",
    exact: true,
  });
  await expect(quantity).toHaveValue("999");
  await expect(iterations).toHaveValue("1000");
  await expect(generated).toHaveValue("1000000");

  await page.getByRole("tab", { name: "Data", exact: true }).click();
  const code = page.getByRole("tabpanel", { name: "Data" }).locator("pre code");
  await quantity.fill("2");
  await notation.fill("2d6");
  await notation.press("Enter");
  await expect(code).toContainText('"notation": "2d6"');
  const previous = await code.textContent();

  for (const invalid of ["3d6", "(1+2)d6"]) {
    await notation.fill(invalid);
    await notation.press("Enter");
    await expect(page.getByRole("alert")).toContainText(/Dice quantity.*2/);
    await expect(code).toHaveText(previous!);
  }

  await iterations.fill("2");
  await generated.fill("10");
  await notation.fill("d6!>=1");
  await notation.press("Enter");
  await expect(code).toContainText('"notation": "d6!>=1"');
  expect(JSON.parse((await code.textContent())!).result.rolls).toHaveLength(3);

  await iterations.fill("10");
  await generated.fill("3");
  await notation.fill("2d6!>=1");
  await notation.press("Enter");
  await expect(code).toContainText('"notation": "2d6!>=1"');
  expect(JSON.parse((await code.textContent())!).result.rolls).toHaveLength(5);
  await expect(page.getByRole("alert")).toHaveCount(0);

  await quantity.fill("4");
  await notation.fill("4d6");
  await notation.press("Enter");
  await expect(code).toContainText('"notation": "4d6"');
  expect(JSON.parse((await code.textContent())!).result.rolls).toHaveLength(4);

  await page.getByRole("button", { name: "D6", exact: true }).click();
  await expect(code).toContainText('"notation": "d6"');
  await expect(quantity).toHaveValue("4");
  await expect(iterations).toHaveValue("10");
  await expect(generated).toHaveValue("3");
});

test("invalid roll limits are reported beside the notation and settings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 812 });
  await page.goto("/playground");
  const notation = page.getByLabel("Notation", { exact: true });
  const roll = page.getByRole("button", { name: "Roll dice", exact: true });
  await notation.fill("2+3");
  await notation.press("Enter");
  await page.getByRole("tab", { name: "Text", exact: true }).click();
  const result = page
    .getByRole("tabpanel", { name: "Text" })
    .getByRole("status");
  await expect(result).toHaveText(/^2\+3:.*= 5$/);

  await page.getByRole("button", { name: "Roll limits", exact: true }).click();
  const fields = [
    page.getByRole("textbox", { name: "Maximum dice quantity", exact: true }),
    page.getByRole("textbox", { name: "Maximum iterations", exact: true }),
    page.getByRole("textbox", { name: "Maximum generated rolls", exact: true }),
  ];
  for (const field of fields) {
    for (const invalid of ["", "0", "-1", "1.5", "9007199254740992"]) {
      await field.fill(invalid);
      await roll.click();
      await expect(field).toHaveAttribute("aria-invalid", "true");
      await expect(notation).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByRole("alert")).toHaveCount(2);
      await expect(
        page.getByRole("alert").filter({
          hasText: "Invalid roll limits. Check the Roll limits section.",
        }),
      ).toBeVisible();
      await expect(result).toHaveText(/^2\+3:.*= 5$/);
    }
    await field.fill("2");
    await expect(field).not.toHaveAttribute("aria-invalid", "true");
    await expect(notation).not.toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
  await notation.fill("3+4");
  await notation.press("Enter");
  await expect(result).toHaveText(/^3\+4:.*= 7$/);
});

test("random engines come from the registry and seed controls follow their capabilities", async ({
  page,
}) => {
  await page.goto("/playground");
  const engine = page.getByLabel("Random engine", { exact: true });
  const seed = page.getByRole("textbox", { name: "Seed", exact: true });
  const generate = page.getByRole("button", {
    name: "Generate seed",
    exact: true,
  });
  const reset = page.getByRole("button", {
    name: "Reset random sequence",
    exact: true,
  });
  const notation = page.getByLabel("Notation", { exact: true });
  const registry = new EngineRegistry();
  const labels: Record<string, string> = {
    nativeMath: "Native Math (default)",
    mersenne: "Mersenne Twister",
    xoroshiro128plus: "Xoroshiro128plus",
    crypto: "Crypto",
  };
  await expect(engine).toContainText("Native Math (default)");
  await expect(seed).toBeHidden();
  await engine.click();
  await expect(page.getByRole("option")).toHaveCount(registry.names.length);
  await page.keyboard.press("Escape");
  await waitForSelectMenuClosed(page, engine);
  await page.getByRole("tab", { name: "Data", exact: true }).click();
  const code = page.getByRole("tabpanel", { name: "Data" }).locator("pre code");
  for (const [index, name] of registry.names.entries()) {
    await selectMenuOption(page, engine, labels[name] ?? name);
    const seedable = ["mersenne", "xoroshiro128plus"].includes(name);
    for (const control of [seed, generate, reset]) {
      if (seedable) {
        await expect(control).toBeVisible();
        await expect(control).toBeEnabled();
      } else {
        await expect(control).toBeHidden();
      }
    }
    // A different notation for each engine proves a fresh roll was made.
    const expression = `${index + 2}d6`;
    await notation.fill(expression);
    await expect(notation).toHaveValue(expression);
    await notation.press("Enter");
    await expect(code).toContainText(`"notation": "${expression}"`);
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
  for (const name of ["mersenne", "xoroshiro128plus"]) {
    await selectMenuOption(page, engine, labels[name]!);
    await seed.fill("-42");
    await expect(seed).toHaveValue("-42");
    const expected = new Roller({ engine: { name, seed: -42 } });
    const rollAndCheck = async (expression: string) => {
      await notation.fill(expression);
      await notation.press("Enter");
      const result = expected.roll(expression).export();
      await expect
        .poll(async () => JSON.parse((await code.textContent())!).result)
        .toEqual(result.result);
    };
    await rollAndCheck("4d20");
    await rollAndCheck("3d20");
    const limits = page.getByRole("button", {
      name: "Roll limits",
      exact: true,
    });
    if ((await limits.getAttribute("aria-expanded")) === "false") {
      await limits.click();
    }
    await page
      .getByRole("textbox", { name: "Maximum dice quantity", exact: true })
      .fill("20");
    await rollAndCheck("5d20");
    await reset.click();
    await expect(code).toContainText('"notation": "5d20"');
    const restarted = new Roller({ engine: { name, seed: -42 } });
    await notation.fill("4d20");
    await notation.press("Enter");
    const restartedRoll = restarted.roll("4d20").export();
    await expect
      .poll(async () => JSON.parse((await code.textContent())!).result)
      .toEqual(restartedRoll.result);
    await generate.click();
    const generated = Number(await seed.inputValue());
    expect(Number.isInteger(generated)).toBe(true);
    expect(generated).toBeGreaterThanOrEqual(-2147483648);
    expect(generated).toBeLessThanOrEqual(2147483647);
    await notation.fill("6d20");
    await notation.press("Enter");
    const generatedRoll = new Roller({ engine: { name, seed: generated } })
      .roll("6d20")
      .export();
    await expect
      .poll(async () => JSON.parse((await code.textContent())!).result)
      .toEqual(generatedRoll.result);
  }
});

test("automatically generated seeds are displayed and reproduce the random sequence", async ({
  page,
}) => {
  await page.goto("/playground");
  const engine = page.getByLabel("Random engine", { exact: true });
  const seed = page.getByRole("textbox", { name: "Seed", exact: true });
  const notation = page.getByLabel("Notation", { exact: true });
  await page.getByRole("tab", { name: "Data", exact: true }).click();
  const code = page.getByRole("tabpanel", { name: "Data" }).locator("pre code");
  await expect(seed).toBeHidden();

  for (const [name, label] of [
    ["mersenne", "Mersenne Twister"],
    ["xoroshiro128plus", "Xoroshiro128plus"],
  ]) {
    // Start with an empty seed before switching to each seedable engine.
    if (name === "xoroshiro128plus") {
      await seed.fill("");
      await selectMenuOption(page, engine, "Crypto");
      await expect(seed).toBeHidden();
    }
    await selectMenuOption(page, engine, label);
    await expect(seed).toHaveValue(/^-?\d+$/);
    const generated = Number(await seed.inputValue());
    expect(generated).toBeGreaterThanOrEqual(-2147483648);
    expect(generated).toBeLessThanOrEqual(2147483647);
    const reference = new Roller({ engine: { name, seed: generated } });
    for (const expression of ["4d20", "3d20"]) {
      await notation.fill(expression);
      await notation.press("Enter");
      const expected = reference.roll(expression).export();
      await expect
        .poll(async () => JSON.parse((await code.textContent())!).result)
        .toEqual(expected.result);
      await expect(seed).toHaveValue(String(generated));
    }
    // Clearing the input before rolling must not hide the seed actually used.
    await seed.fill("");
    await notation.fill("6d20");
    await notation.press("Enter");
    await expect(seed).toHaveValue(/^-?\d+$/);
    const replacement = Number(await seed.inputValue());
    const expected = new Roller({ engine: { name, seed: replacement } })
      .roll("6d20")
      .export();
    await expect
      .poll(async () => JSON.parse((await code.textContent())!).result)
      .toEqual(expected.result);
  }
});

test("invalid seeds preserve the last result and are ignored for non-seedable engines", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 812 });
  await page.goto("/playground");
  const notation = page.getByLabel("Notation", { exact: true });
  const engine = page.getByLabel("Random engine", { exact: true });
  const seed = page.getByRole("textbox", { name: "Seed", exact: true });
  await notation.fill("2+3");
  await notation.press("Enter");
  await page.getByRole("tab", { name: "Text", exact: true }).click();
  const result = page
    .getByRole("tabpanel", { name: "Text" })
    .getByRole("status");
  await expect(result).toHaveText(/^2\+3:.*= 5$/);
  await selectMenuOption(page, engine, "Mersenne Twister");
  for (const invalid of ["abc", "1.5", "2147483648", "-2147483649"]) {
    await seed.fill(invalid);
    await notation.fill("d6");
    await notation.press("Enter");
    await expect(seed).toHaveAttribute("aria-invalid", "true");
    await expect(notation).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert")).toHaveCount(2);
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Invalid seed. Check the Seed field." }),
    ).toBeVisible();
    await expect(result).toHaveText(/^2\+3:.*= 5$/);
  }
  await selectMenuOption(page, engine, "Crypto");
  await expect(seed).toBeHidden();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await notation.press("Enter");
  await expect(result).toHaveText(/^d6:/);
  await selectMenuOption(page, engine, "Mersenne Twister");
  await seed.fill("");
  await notation.press("Enter");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(result).toHaveText(/^d6:/);
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`seed controls collapse without leaving a gap (${reducedMotion})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto("/playground");
    const engine = page.getByLabel("Random engine", { exact: true });
    const controls = page.locator("#playground-seed-controls");
    const seed = page.getByRole("textbox", { name: "Seed", exact: true });
    const advanced = page.getByRole("button", {
      name: "Variables",
      exact: true,
    });
    await expect(seed).toBeHidden();
    await expect
      .poll(() =>
        controls.evaluate((element) => element.getBoundingClientRect().height),
      )
      .toBe(0);
    const collapsedTop = await advanced.evaluate(
      (element) => element.getBoundingClientRect().top + window.scrollY,
    );

    await controls.evaluate((element) => {
      element.addEventListener("animationstart", (event) => {
        element.dataset.lastAnimation = (event as AnimationEvent).animationName;
      });
    });
    await selectMenuOption(page, engine, "Mersenne Twister");
    await expect(seed).toBeVisible();
    await seed.fill("42");
    await expect(seed).toHaveValue("42");
    if (reducedMotion === "no-preference") {
      await expect(controls).toHaveAttribute(
        "data-last-animation",
        "collapsible-down",
      );
    } else {
      await expect(controls).not.toHaveAttribute("data-last-animation", /.+/);
    }
    await expect
      .poll(() =>
        advanced.evaluate(
          (element) => element.getBoundingClientRect().top + window.scrollY,
        ),
      )
      .toBeGreaterThan(collapsedTop);

    await selectMenuOption(page, engine, "Crypto");
    await expect(seed).toBeHidden();
    if (reducedMotion === "no-preference") {
      await expect(controls).toHaveAttribute(
        "data-last-animation",
        "collapsible-up",
      );
    } else {
      await expect(controls).not.toHaveAttribute("data-last-animation", /.+/);
    }
    await expect
      .poll(() =>
        controls.evaluate((element) => element.getBoundingClientRect().height),
      )
      .toBe(0);
    await expect
      .poll(() =>
        advanced.evaluate(
          (element) => element.getBoundingClientRect().top + window.scrollY,
        ),
      )
      .toBeCloseTo(collapsedTop, 1);
    await selectMenuOption(page, engine, "Mersenne Twister");
    await expect(seed).toHaveValue("42");
  });
}
