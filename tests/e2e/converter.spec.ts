import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { legacyExample } from "../../app/data/converter-example";

async function selectOption(page: Page, field: string, option: string) {
  await page.getByLabel(field, { exact: true }).click();
  const menu = page.getByRole("listbox", { name: field, exact: true });
  await menu.getByRole("option", { name: option, exact: true }).click();
  await expect(menu).toBeHidden();
}

test("converts a legacy export and downloads the result", async ({ page }) => {
  await page.goto("/converter");
  await page.getByRole("button", { name: "Load example" }).click();
  const input = page.getByRole("textbox", { name: "Data to convert" });
  await expect(input).toHaveValue(JSON.stringify(legacyExample, null, 2));
  await page.getByRole("button", { name: "Convert data" }).click();
  const output = page.getByRole("textbox", { name: "Converted data" });
  await expect(output).toBeVisible();
  const form = page.getByRole("form", { name: "Conversion options" });
  await expect(
    form.getByRole("status", { name: "Conversion status" }),
  ).toContainText("Conversion complete.");
  expect(JSON.parse(await output.inputValue())).toMatchObject({
    type: "roll",
    version: 1,
    notation: "2d6",
    total: 7,
  });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "converted-roll-schema-1-full.json",
  );
  expect(await download.failure()).toBeNull();

  await selectOption(page, "Output format", "Concise");
  await expect(output).toHaveCount(0);
  await selectOption(page, "Encoding", "Base64");
  await page.getByRole("button", { name: "Convert data" }).click();
  await expect(output).toBeVisible();
  expect(
    JSON.parse(
      Buffer.from(await output.inputValue(), "base64").toString("utf8"),
    ),
  ).toEqual({ notation: "2d6", rolls: [[2, 5]] });
});

test("validates input and recovers from conversion errors", async ({
  page,
}) => {
  await page.goto("/converter");
  const submit = page.getByRole("button", { name: "Convert data" });
  const input = page.getByRole("textbox", { name: "Data to convert" });
  await submit.click();
  await expect(
    page.getByText("Enter some exported dice roller data."),
  ).toBeVisible();
  await input.fill("{invalid");
  await submit.click();
  await expect(page.getByRole("alert")).toContainText("Conversion failed");

  await page.getByRole("button", { name: "Load example" }).click();
  await selectOption(page, "Input encoding", "Base64");
  await submit.click();
  await expect(
    page.getByText("Expected Base64-encoded export data."),
  ).toBeVisible();
  await selectOption(page, "Input encoding", "JSON");
  await selectOption(page, "Source version", "Schema 1 (v6)");
  await submit.click();
  await expect(page.getByRole("alert")).toContainText(
    "Expected source version",
  );
  await selectOption(page, "Source version", "Auto-detect");
  await submit.click();
  await expect(
    page.getByRole("textbox", { name: "Converted data" }),
  ).toBeVisible();
});

test("uploads Base64 data and copies converted output", async ({
  page,
  context,
  browserName,
}) => {
  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  }
  await page.goto("/converter");
  const base64 = Buffer.from(JSON.stringify(legacyExample)).toString("base64");
  await page.locator('input[type="file"]').setInputFiles({
    name: "roll.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(base64),
  });
  await expect(
    page.getByRole("textbox", { name: "Data to convert" }),
  ).toHaveValue(base64);
  await page.getByRole("button", { name: "Convert data" }).click();
  const output = page.getByRole("textbox", { name: "Converted data" });
  await expect(output).toBeVisible();
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Conversion status" }),
  ).toContainText("Converted data copied to clipboard.");
  // Firefox requires a paste prompt to read the clipboard. The actual write
  // is still exercised in both browsers; Chromium also verifies its contents.
  if (browserName === "chromium") {
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      await output.inputValue(),
    );
  }
});

for (const width of [1280, 375]) {
  test(`converter output keeps its size at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/converter");
    await page.getByRole("button", { name: "Load example" }).click();
    const card = page.getByRole("region", { name: "Output", exact: true });
    const empty = card.locator('[data-slot="root"]').filter({
      has: page.getByText("Your converted data will appear here."),
    });
    const placeholder = empty.last();
    await expect(placeholder).toBeVisible();
    const before = await placeholder.boundingBox();
    const cardBefore = await card.boundingBox();
    await page.getByRole("button", { name: "Convert data" }).click();
    const output = page.getByRole("textbox", { name: "Converted data" });
    await expect(output).toBeVisible();
    const after = await output.boundingBox();
    const cardAfter = await card.boundingBox();

    expect(after?.width).toBeCloseTo(before!.width, 0);
    expect(after?.height).toBeCloseTo(before!.height, 0);
    expect(cardAfter?.height).toBeCloseTo(cardBefore!.height, 0);
  });
}

test("strict conversion rejects inconsistent totals and best effort warns", async ({
  page,
}) => {
  await page.goto("/converter");
  const input = page.getByRole("textbox", { name: "Data to convert" });
  const output = page.getByRole("textbox", { name: "Converted data" });
  const submit = page.getByRole("button", { name: "Convert data" });
  const form = page.getByRole("form", { name: "Conversion options" });
  await input.fill(JSON.stringify({ ...legacyExample, total: 8 }));
  await submit.click();
  await expect(form.getByRole("alert")).toContainText("Conversion failed");
  await expect(output).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download" })).toBeDisabled();

  await page.getByRole("switch", { name: "Strict conversion" }).click();
  await submit.click();
  await expect(
    form.getByRole("status", { name: "Conversion status" }),
  ).toContainText("Conversion complete with warnings.");
  await expect(
    form.getByText("Conversion warnings", { exact: true }),
  ).toBeVisible();
  await expect(
    form.getByText(/data\.total: Stored value 8 differs/),
  ).toBeVisible();
  await expect(output).toBeVisible();
  expect(JSON.parse(await output.inputValue())).toMatchObject({ total: 7 });
});

for (const count of [2, 1000]) {
  test(`converts a history containing ${count} rolls`, async ({ page }) => {
    await page.goto("/converter");
    const history = {
      type: "dice-roller",
      log: Array.from({ length: count }, () => legacyExample),
      output: Array.from({ length: count }, () => legacyExample.output).join(
        "; ",
      ),
      total: count * 7,
    };
    await page
      .getByRole("textbox", { name: "Data to convert" })
      .fill(JSON.stringify(history));
    await page.getByRole("button", { name: "Convert data" }).click();
    const output = page.getByRole("textbox", { name: "Converted data" });
    await expect(output).toBeVisible();
    const result = JSON.parse(await output.inputValue());
    expect(result).toMatchObject({
      type: "history",
      version: 1,
      total: count * 7,
    });
    expect(result.rolls).toHaveLength(count);
    for (const roll of result.rolls) {
      expect(roll).toMatchObject({ notation: "2d6", total: 7 });
      expect(
        roll.result.rolls.map((die: { value: number }) => die.value),
      ).toEqual([2, 5]);
    }
  });
}

test("detects the source and restricts targets and history formats", async ({
  page,
}) => {
  await page.goto("/converter");
  const input = page.getByRole("textbox", { name: "Data to convert" });
  const target = page.getByLabel("Target version", { exact: true });
  const format = page.getByLabel("Output format", { exact: true });
  await page.getByRole("button", { name: "Load example" }).click();
  await expect(page.getByText("Detected: Legacy (v5)")).toBeVisible();
  await selectOption(page, "Target version", "Legacy (v5)");

  await input.fill(JSON.stringify({ notation: "2d6", rolls: [[2, 5]] }));
  await expect(page.getByText("Detected: Schema 1 (v6)")).toBeVisible();
  await expect(target).toContainText("Schema 1 (v6)");
  await target.click();
  const targets = page.getByRole("listbox", { name: "Target version" });
  await expect(
    targets.getByRole("option", { name: "Legacy (v5)" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(targets).toBeHidden();
  await selectOption(page, "Output format", "Concise");

  const history = {
    type: "dice-roller",
    log: [legacyExample],
    output: legacyExample.output,
    total: 7,
  };
  await input.fill(Buffer.from(JSON.stringify(history)).toString("base64"));
  await expect(page.getByText("Detected: Legacy (v5)")).toBeVisible();
  await expect(format).toContainText("Full");
  await format.click();
  const formats = page.getByRole("listbox", { name: "Output format" });
  await expect(formats.getByRole("option", { name: "Full" })).toBeVisible();
  await expect(formats.getByRole("option", { name: "Concise" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(formats).toBeHidden();

  await input.fill("{invalid");
  await expect(page.getByText(/Detected:/)).toHaveCount(0);
  await selectOption(page, "Output format", "Concise");

  await input.fill(JSON.stringify({ type: "roll", version: 999 }));
  await expect(
    page.getByText("Detected: Schema 999 (unsupported)"),
  ).toBeVisible();
  await expect(target).toBeDisabled();
  await input.fill("");
  await expect(target).toBeEnabled();
});

test("download names retain the uploaded stem and describe the output", async ({
  page,
}) => {
  await page.goto("/converter");
  const input = page.getByRole("textbox", { name: "Data to convert" });
  const submit = page.getByRole("button", { name: "Convert data" });
  const downloadButton = page.getByRole("button", { name: "Download" });
  const source = JSON.stringify(legacyExample);

  async function downloadName() {
    const pending = page.waitForEvent("download");
    await downloadButton.click();
    return (await pending).suggestedFilename();
  }

  await page.locator('input[type="file"]').setInputFiles({
    name: "character.history.json",
    mimeType: "application/json",
    buffer: Buffer.from(source),
  });
  await expect(input).toHaveValue(source);
  await submit.click();
  expect(await downloadName()).toBe("character.history-schema-1-full.json");

  await selectOption(page, "Target version", "Latest supported");
  await selectOption(page, "Output format", "Concise");
  await selectOption(page, "Encoding", "Base64");
  await submit.click();
  expect(await downloadName()).toBe("character.history-schema-1-concise.txt");

  await selectOption(page, "Target version", "Legacy (v5)");
  await submit.click();
  expect(await downloadName()).toBe("character.history-v5-full.txt");

  await input.fill(JSON.stringify(legacyExample, null, 2));
  await submit.click();
  expect(await downloadName()).toBe("converted-roll-v5-full.txt");
});

test("mobile conversion feedback is visible and links to the output", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/converter");
  const input = page.getByRole("textbox", { name: "Data to convert" });
  const submit = page.getByRole("button", { name: "Convert data" });
  await submit.click();
  await expect(input).toBeFocused();
  await expect(
    page.getByText("Enter some exported dice roller data."),
  ).toBeInViewport();

  await input.fill("{invalid");
  await submit.click();
  await expect(page.getByRole("alert")).toBeInViewport();

  await page.getByRole("button", { name: "Load example" }).click();
  await submit.click();
  const status = page.getByRole("status", { name: "Conversion status" });
  await expect(status).toContainText("Conversion complete.");
  await expect(status).toBeInViewport();
  await page.getByRole("button", { name: "View converted output" }).click();
  const heading = page.getByRole("heading", { name: "Output", exact: true });
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
});

test("a clipboard failure leaves the output available for manual copying", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        },
      },
    });
  });
  await page.goto("/converter");
  await page.getByRole("button", { name: "Load example" }).click();
  await page.getByRole("button", { name: "Convert data" }).click();
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(page.getByText(/Could not copy automatically/)).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Converted data" }),
  ).toHaveValue(/"total": 7/);
  await expect(page.getByRole("button", { name: "Download" })).toBeEnabled();
});

test("success feedback shares one location and expires without clearing output", async ({
  page,
}) => {
  await page.goto("/converter");
  await page.clock.install();
  await page.getByRole("button", { name: "Load example" }).click();
  await page.getByRole("button", { name: "Convert data" }).click();
  const status = page.getByRole("status", { name: "Conversion status" });
  const output = page.getByRole("textbox", { name: "Converted data" });
  await expect(status).toContainText("Conversion complete.");

  await page.clock.fastForward(3000);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  await pending;
  await expect(status).toContainText("Download started.");
  await expect(
    page.getByText("Conversion complete.", { exact: true }),
  ).toHaveCount(0);

  await page.clock.fastForward(3000);
  await expect(status).toContainText("Download started.");
  await page.clock.fastForward(2500);
  await expect(status).toBeEmpty();
  await expect(output).toBeVisible();
  await expect(page.getByRole("button", { name: "Download" })).toBeEnabled();

  await page.getByRole("button", { name: "Convert data" }).click();
  await expect(status).toContainText("Conversion complete.");
  await page.clock.fastForward(5500);
  await expect(status).toBeEmpty();
  await expect(output).toBeVisible();
});

test("conversion errors and detailed warnings persist until the input changes", async ({
  page,
}) => {
  await page.goto("/converter");
  await page.clock.install();
  const input = page.getByRole("textbox", { name: "Data to convert" });
  const submit = page.getByRole("button", { name: "Convert data" });
  await input.fill("{invalid");
  await submit.click();
  const error = page.getByRole("alert");
  await expect(error).toContainText("Conversion failed");
  await page.clock.fastForward(10000);
  await expect(error).toBeVisible();

  await input.fill(JSON.stringify({ ...legacyExample, total: 8 }));
  await expect(error).toHaveCount(0);
  await page.getByRole("switch", { name: "Strict conversion" }).click();
  await submit.click();
  const warnings = page.getByText("Conversion warnings", { exact: true });
  await expect(warnings).toBeVisible();
  await page.clock.fastForward(10000);
  await expect(warnings).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Conversion status" }),
  ).toBeEmpty();
  await input.fill(JSON.stringify(legacyExample));
  await expect(warnings).toHaveCount(0);
});
