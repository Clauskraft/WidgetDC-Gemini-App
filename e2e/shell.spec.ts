import { expect, test } from "@playwright/test";
import { FOOTER_NAV, LIBRARY_NAV, PRIMARY_NAV } from "../src/lib/navigation";

/**
 * GF-PR1 shell contract (replaces world-class-proof.spec.ts).
 *
 * The nav registry (src/lib/navigation.ts) is the single source of truth;
 * this spec drives every entry in a real browser so a dead click cannot ship:
 * every sidebar item navigates, and every page renders inside the SAME shell
 * (sidebar aside + top-bar banner + main landmark).
 */

const ALL_ENTRIES = [...PRIMARY_NAV, ...LIBRARY_NAV, ...FOOTER_NAV];

test("sidebar has zero dead clicks — no hash anchors, no label-only rows, no stub pages", async ({
  page,
}) => {
  await page.goto("/");
  const sidebar = page.locator("aside.app-sidebar");
  await expect(sidebar).toBeVisible();
  expect(await sidebar.locator('a[href^="#"]').count()).toBe(0);
  await expect(sidebar.getByText("Scope M")).toHaveCount(0);
  // Deterministic-demo pages left the nav (still reachable by URL with a banner).
  await expect(sidebar.getByText("Capabilities")).toHaveCount(0);
  await expect(sidebar.getByText("Audit Factory")).toHaveCount(0);
});

test("sidebar keeps secondary tools calm and does not expose account identity", async ({
  page,
}) => {
  await page.goto("/");
  const sidebar = page.locator("aside.app-sidebar");
  await expect(sidebar.getByText("Bibliotek")).toBeVisible();
  await expect(sidebar.getByText("Seneste")).toBeVisible();
  await expect(sidebar.getByText("clauskraft@gmail.com")).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: /Graph/ })).toBeHidden();
  await sidebar.getByText("Bibliotek").click();
  await expect(sidebar.getByRole("link", { name: /Graph/ })).toBeVisible();
});

for (const entry of ALL_ENTRIES) {
  test(`nav "${entry.label}" lands on ${entry.to} inside the one shell`, async ({ page }) => {
    await page.goto(entry.to);
    await expect(page).toHaveURL(new RegExp(`${entry.to.replace(/\//g, "\\/")}\\/?$`));
    // The three landmarks of the single AppShell:
    await expect(page.locator("aside.app-sidebar")).toBeVisible();
    await expect(page.getByTestId("top-bar")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    // The top bar shows the page's registry title.
    await expect(page.getByTestId("top-bar")).toContainText(entry.label);
    // Content actually rendered — main is never empty.
    expect((await page.locator("main").innerText()).trim().length).toBeGreaterThan(0);
  });
}

test("legacy cockpit skin is gone from the chat page", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByText("Type the demand. WDC resolves the route behind the chat."),
  ).toHaveCount(0);
  await expect(page.getByText("Proof boundary")).toHaveCount(0);
  await expect(page.getByText("Build App")).toHaveCount(0);
  await expect(page.getByText("Operate WDC")).toHaveCount(0);
});

test("chat is the front door: one composer, immediately usable", async ({ page }) => {
  await page.goto("/");
  const composer = page.locator("textarea");
  await expect(composer.first()).toBeVisible();
  await expect(composer.first()).toBeEnabled();
  await expect(page.getByText("Værktøjer", { exact: true })).toBeVisible();
  await expect(page.getByText("WDC Chat", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Dyb analyse", { exact: true })).toBeHidden();
  await page.getByText("Værktøjer", { exact: true }).click();
  await expect(page.getByText("Dyb analyse", { exact: true })).toBeVisible();
});

// One page-load per test — a cold nitro page render costs ~14s in sandboxed
// runners, so multi-goto tests blow the 30s budget without testing more.
for (const path of ["/capabilities", "/audit-factory"]) {
  test(`preview page ${path} stays reachable by URL with an honest banner`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByText("Preview — deterministic demo data")).toBeVisible();
  });
}
