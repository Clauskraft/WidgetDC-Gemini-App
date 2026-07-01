import { expect, test, type Locator, type Page } from "@playwright/test";

async function stubChat(page: Page) {
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream" },
      body: "data: [DONE]\n\n",
    });
  });
}

async function waitForHydration(page: Page) {
  await page.waitForFunction(() => document.documentElement.dataset.appHydrated === "true");
  await expect(page.getByRole("button", { name: /WDC Chat/i }).first()).toBeVisible();
  await expect(page.locator('[aria-label="WDC Agent Office canvas"]')).toBeVisible();
}

async function expectUsablePanel(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(180);
  expect(box?.height ?? 0).toBeGreaterThan(40);
  const text = (await locator.textContent())?.trim() ?? "";
  expect(text.length).toBeGreaterThan(12);
}

function intersects(
  a: NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>,
  b: NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>,
) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function percentile95(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? Infinity;
}

test.describe("World-class capability cockpit proof harness", () => {
  test("keeps primary cockpit panels visible, nonblank and non-overlapping", async ({ page }) => {
    await stubChat(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await waitForHydration(page);

    await expectUsablePanel(page.locator('[aria-label="WDC Agent Office canvas"]'));
    await expectUsablePanel(page.getByRole("region", { name: /World-class contract/i }));
    await expectUsablePanel(page.getByRole("region", { name: /Capability Library/i }));
    await expectUsablePanel(page.getByRole("region", { name: /Compose candidate recipe/i }));

    const chatBox = await page.locator(".agent-office-chat").boundingBox();
    const canvasBox = await page.locator(".agent-office-canvas").boundingBox();
    expect(chatBox).not.toBeNull();
    expect(canvasBox).not.toBeNull();
    expect(intersects(chatBox!, canvasBox!)).toBe(false);
  });

  test("keeps the mobile cockpit readable without blank proof panels", async ({ page }) => {
    await stubChat(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await waitForHydration(page);

    const contractPanel = page.getByRole("region", { name: /World-class contract/i });
    await expectUsablePanel(contractPanel);
    await expect(contractPanel.getByText("diagnostic_only", { exact: true })).toBeVisible();
    await expect(contractPanel.getByText("runtime missing_evidence")).toBeVisible();
  });

  test("supports keyboard-safe composition and keeps interaction latency under diagnostic targets", async ({
    page,
  }) => {
    await stubChat(page);
    await page.goto("/");
    await waitForHydration(page);

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const activeElement = await page.evaluate(() => {
      const element = document.activeElement;
      return {
        tag: element?.tagName,
        label: element?.getAttribute("aria-label") ?? element?.textContent ?? "",
      };
    });
    expect(["BUTTON", "TEXTAREA", "A"]).toContain(activeElement.tag);

    const workModeSamples = await page.evaluate(async () => {
      const labels = ["Build App", "General", "Build App", "General", "Build App", "General"];
      const samples: number[] = [];
      for (const label of labels) {
        const button = [...document.querySelectorAll<HTMLButtonElement>('button[role="tab"]')].find(
          (element) => element.textContent?.includes(label),
        );
        if (!button) return [Number.POSITIVE_INFINITY];
        const start = performance.now();
        button.click();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        samples.push(performance.now() - start);
      }
      return samples.slice(1);
    });
    const workModeMs = percentile95(workModeSamples);
    await page.getByRole("tab", { name: /Build App/i }).click();
    await expect(page.getByRole("tab", { name: /Build App/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(workModeMs).toBeLessThanOrEqual(250);

    const libraryMs = await page.evaluate(async () => {
      const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
        (element) => element.textContent?.trim() === "Widgets",
      );
      if (!button) return Number.POSITIVE_INFINITY;
      const start = performance.now();
      button.click();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return performance.now() - start;
    });
    await expect(
      page.getByRole("button", { name: "Select widget capability 1", exact: true }),
    ).toBeVisible();
    expect(libraryMs).toBeLessThanOrEqual(150);

    const recipeMs = await page.evaluate(async () => {
      const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find((element) =>
        element.getAttribute("aria-label")?.includes("Select widget capability 1"),
      );
      if (!button) return Number.POSITIVE_INFINITY;
      const start = performance.now();
      button.click();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return performance.now() - start;
    });
    await expect(page.getByRole("region", { name: /Compose candidate recipe/i })).toContainText(
      "mapped 0",
    );
    expect(recipeMs).toBeLessThanOrEqual(500);

    await expect(page.getByRole("button", { name: /Activate blocked/i })).toBeDisabled();
  });
});
