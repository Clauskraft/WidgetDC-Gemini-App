import { expect, test } from "@playwright/test";

test("widgets list opens the selected widget chat", async ({ page }) => {
  await page.goto("/gems");

  await expect(page.getByRole("heading", { name: "Widgets" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Consulting Strategist/i })).toBeVisible();

  await page.getByRole("link", { name: /Consulting Strategist/i }).click();

  await expect(page).toHaveURL(/\/gems\/consulting-strategist$/);
  await expect(page.getByText("Widget · Consulting Strategist")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Consulting Strategist" })).toBeVisible();
  await expect(page.getByRole("button", { name: /SCQA \+ issue-tree/i })).toBeVisible();
});

test("direct widget route renders chat instead of the list page", async ({ page }) => {
  await page.goto("/gems/cyber-defender");

  await expect(page.getByText("Widget · Cyber Defender")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cyber Defender" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Widgets" })).toHaveCount(0);
});

test("cyber and OSINT widgets expose patterns and data surfaces", async ({ page }) => {
  await page.goto("/gems");

  const cyber = page.getByRole("link", { name: /Cyber Defender/i });
  await expect(cyber.getByText("ATT&CK Detection Engineering")).toBeVisible();
  await expect(cyber.getByText("Detection telemetry")).toBeVisible();

  const osint = page.getByRole("link", { name: /OSINT Analyst/i });
  await expect(osint.getByText("Selector Pivot Graph")).toBeVisible();
  await expect(osint.getByText("Media & geospatial")).toBeVisible();
});
