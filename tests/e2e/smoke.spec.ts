import { test, expect, type Page } from "@playwright/test";

// Against a live deployment (E2E_BASE_URL) only the tests that don't depend on
// the mock fixture run; entity pages and fixture names are mock-only.
const LIVE = Boolean(process.env.E2E_BASE_URL);

const PAGES = [
  { path: "/", heading: "Contractació pública a Catalunya" },
  { path: "/contractes", heading: "Explorador de contractes" },
  { path: "/empreses", heading: "Empreses adjudicatàries" },
  { path: "/organismes", heading: /Organismes/ },
  { path: "/analisi", heading: "Anàlisi ciutadana" },
  ...(LIVE
    ? [{ path: "/organismes/Ajuntament%20de%20Barcelona", heading: "Ajuntament de Barcelona" }]
    : [
        { path: "/empreses/A08000001", heading: "EMPRESA MOCK U SL" },
        { path: "/organismes/Ajuntament%20de%20Barcelona", heading: "Ajuntament de Barcelona" },
      ]),
];

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(1);
}

for (const { path, heading } of PAGES) {
  test(`renders ${path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });
}

test("manifest and icons are served", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const json = await manifest.json();
  expect(json.short_name).toBe("contractes.cat");
  for (const icon of json.icons) {
    const res = await request.get(icon.src);
    expect(res.status(), icon.src).toBe(200);
  }
});

test("contracts API accepts date range and sort", async ({ request }) => {
  const res = await request.get("/api/contractes?date_from=2024-01-01&date_to=2024-12-31&sort=amount-desc&page=1");
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(Array.isArray(json.data)).toBe(true);
  expect(typeof json.total).toBe("number");
});

test("contracts table links awardee and organ", async ({ page }) => {
  test.skip(LIVE, "fixture names only exist in the mock");
  await page.goto("/contractes");
  const awardee = page.getByRole("link", { name: "EMPRESA MOCK U SL" }).first();
  await expect(awardee).toHaveAttribute("href", /\/empreses\/A08000001/);
  const organ = page.getByRole("link", { name: "Ajuntament de Barcelona" }).first();
  await expect(organ).toHaveAttribute("href", /\/organismes\/Ajuntament%20de%20Barcelona/);
});

test.describe("mobile explorer", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile-only layout");

  test("bottom navigation is visible and marks the active tab", async ({ page }) => {
    await page.goto("/contractes");
    const nav = page.getByRole("navigation", { name: "Navegació principal" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Contractes" })).toHaveAttribute("aria-current", "page");
  });

  test("filter sheet opens, applies a filter and shows chips", async ({ page }) => {
    await page.goto("/contractes");
    await page.getByRole("button", { name: /^Filtres/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Tipus de contracte").selectOption("Obres");
    await dialog.getByRole("button", { name: /^Mostra/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: /Treu el filtre Tipus/ })).toBeVisible();
    await expect(page).toHaveURL(/tipus_contracte=Obres/);
    // Removing the chip clears the filter from the URL.
    await page.getByRole("button", { name: /Treu el filtre Tipus/ }).click();
    await expect(page).not.toHaveURL(/tipus_contracte/);
  });

  test("pagination uses the compact previous/next controls", async ({ page }) => {
    await page.goto("/empreses");
    const nav = page.getByRole("navigation", { name: "Paginació" });
    await expect(nav.getByRole("button", { name: /Següent/ })).toBeVisible();
    await expect(nav.getByText(/Pàg\. 1 de/)).toBeVisible();
  });

  test("home search mode control fits in one row", async ({ page }) => {
    await page.goto("/");
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(3);
    const boxes = await tabs.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
    expect(new Set(boxes.map((b) => Math.round(b))).size).toBe(1);
  });
});
