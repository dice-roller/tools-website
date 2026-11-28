import { expect, test } from "@playwright/test";

for (const tool of [
  {
    route: "/converter",
    input: "Data to convert",
    submit: "Convert data",
    action: "Upload file",
  },
  {
    route: "/playground",
    input: "Notation",
    submit: "Roll dice",
    action: "D6",
  },
]) {
  test(`${tool.route} controls wait for hydration`, async ({ page }) => {
    let releaseScripts!: () => void;
    const scriptsReady = new Promise<void>((resolve) => {
      releaseScripts = resolve;
    });
    await page.route("**/_nuxt/**", async (route) => {
      if (route.request().resourceType() === "script") {
        await scriptsReady;
      }
      await route.continue();
    });

    const input = page.getByRole("textbox", { name: tool.input, exact: true });
    const submit = page.getByRole("button", { name: tool.submit, exact: true });
    const action = page.getByRole("button", { name: tool.action, exact: true });

    try {
      await page.goto(tool.route, { waitUntil: "commit" });
      await expect(input).toBeDisabled();
      await expect(submit).toBeDisabled();
      await expect(action).toBeDisabled();
      if (tool.route === "/converter") {
        await expect(page.locator('input[type="file"]')).toBeDisabled();
      }
    } finally {
      releaseScripts();
    }

    await expect(input).toBeEnabled();
    await expect(submit).toBeEnabled();
    await expect(action).toBeEnabled();
    if (tool.route === "/converter") {
      await expect(page.locator('input[type="file"]')).toBeEnabled();
      await page.getByRole("button", { name: "Load example" }).click();
      await submit.click();
      await expect(
        page.getByRole("textbox", { name: "Converted data" }),
      ).toBeVisible();
    } else {
      await input.fill("2+3");
      await input.press("Enter");
      await expect(
        page.getByRole("tabpanel", { name: "Visual" }).getByRole("status"),
      ).toHaveText(/^2\+3:.*= 5$/);
    }
  });
}
