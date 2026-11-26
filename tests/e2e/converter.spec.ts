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
  expect(JSON.parse(await output.inputValue())).toMatchObject({
    type: "roll",
    version: 1,
    notation: "2d6",
    total: 7,
  });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("converted-roll.json");
  expect(await download.failure()).toBeNull();

  await selectOption(page, "Output format", "Concise");
  await expect(output).toHaveCount(0);
  await selectOption(page, "Encoding", "Base64");
  await page.getByRole("button", { name: "Convert data" }).click();
  await expect(output).toBeVisible();
  expect(
    JSON.parse(Buffer.from(await output.inputValue(), "base64").toString("utf8")),
  ).toEqual({ notation: "2d6", rolls: [[2, 5]] });
});

test("validates input and recovers from conversion errors", async ({ page }) => {
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
  await expect(page.getByRole("alert")).toContainText("Expected source version");
  await selectOption(page, "Source version", "Auto-detect");
  await submit.click();
  await expect(
    page.getByRole("textbox", { name: "Converted data" }),
  ).toBeVisible();
});

test("uploads Base64 data and copies converted output", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
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
    page.getByText("Converted data copied to clipboard."),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    await output.inputValue(),
  );
});
