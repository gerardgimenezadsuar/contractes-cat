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

// The home search used to show "no results" while a slow request was still
// running (an aborted request switched the loading state off), and read any
// backend failure as an empty result set.
test.describe("home search resilience", () => {
  // Keystrokes sent before React hydrates never reach the component, so the
  // scenario below (two overlapping requests) needs a hydrated input.
  async function openHydratedHome(page: Page) {
    await page.goto("/");
    await page.waitForFunction(() => {
      const el = document.querySelector("#home-search-input");
      return Boolean(el && Object.keys(el).some((key) => key.startsWith("__reactFiber")));
    });
    return page.locator("#home-search-input");
  }

  const row = {
    identificacio_adjudicatari: "A08000001",
    denominacio_adjudicatari: "EMPRESA MOCK U SL",
    total: "1000",
    num_contracts: "3",
    total_current_year: "0",
  };

  test("a slow search shows the loading state, never an empty one", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/empreses?*", async (route) => {
      calls += 1;
      if (calls <= 2) await new Promise((resolve) => setTimeout(resolve, 1500));
      try {
        await route.fulfill({ json: { data: [row] } });
      } catch {
        // The browser aborted this request when the user kept typing.
      }
    });
    const input = await openHydratedHome(page);
    await input.pressSequentially("em", { delay: 40 });
    await page.waitForTimeout(450); // first request is in flight
    await input.pressSequentially("presa", { delay: 40 }); // second request supersedes it
    const empty = page.getByText("No s'han trobat empreses.");
    const deadline = Date.now() + 1500;
    while (Date.now() < deadline) {
      await expect(empty).toHaveCount(0);
      await page.waitForTimeout(100);
    }
    await expect(page.getByRole("link", { name: /EMPRESA MOCK U SL A08000001/ })).toBeVisible({ timeout: 5000 });
  });

  test("a backend failure shows an error with retry, not an empty state", async ({ page }) => {
    let fail = true;
    await page.route("**/api/empreses?*", async (route) => {
      if (fail) return route.fulfill({ status: 500, body: "Internal Server Error" });
      await route.fulfill({ json: { data: [row] } });
    });
    const input = await openHydratedHome(page);
    await input.fill("empresa");
    // Next.js renders its own empty role="alert" route announcer; filter it out.
    const alert = page.getByRole("alert").filter({ hasText: "No s'ha pogut completar la cerca" });
    await expect(alert).toBeVisible();
    await expect(page.getByText("No s'han trobat empreses.")).toHaveCount(0);
    fail = false;
    await alert.getByRole("button", { name: "Torna-ho a provar" }).click();
    await expect(page.getByRole("link", { name: /EMPRESA MOCK U SL A08000001/ })).toBeVisible();
  });
});
