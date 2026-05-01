import { expect, test } from "@playwright/test";

test.describe("Dashboard mobile premium", () => {
  test.use({
    storageState: process.env.PLAYWRIGHT_STORAGE_STATE,
    viewport: { width: 390, height: 844 },
  });

  test.skip(!process.env.PLAYWRIGHT_STORAGE_STATE, "Serve PLAYWRIGHT_STORAGE_STATE con sessione autenticata.");

  test("azioni mobile compatte, bottom nav con Diario e news carousel", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByPlaceholder("Scrivi un messaggio...")).toBeVisible({ timeout: 30_000 });

    const addButton = page.getByTestId("mobile-add-asset-button");
    await expect(addButton).toBeVisible();
    await expect(addButton).toHaveAttribute("aria-label", "Aggiungi asset");

    const mobileActionsButton = page.getByTestId("mobile-actions-menu-button");
    await expect(mobileActionsButton).toBeVisible();
    await mobileActionsButton.click();
    const mobileActionsMenu = page.getByTestId("mobile-actions-menu");
    await expect(mobileActionsMenu).toBeVisible();
    await expect(mobileActionsMenu.getByRole("button", { name: "Importa con Mate" })).toBeVisible();
    await expect(mobileActionsMenu.getByRole("button", { name: "Apri analisi" })).toBeVisible();

    await expect(page.getByTestId("mobile-nav-diary")).toBeVisible();

    const newsExpandButton = page.getByTestId("mobile-news-expand-button");
    await expect(newsExpandButton).toBeVisible();
    const carousel = page.getByTestId("news-carousel-mobile");
    await expect(carousel).toBeVisible();
    await expect(carousel.locator("article").first()).toBeVisible();

    await newsExpandButton.click();
    await expect(page.getByRole("link", { name: "Leggi articolo" }).first()).toBeVisible();
  });

  test("desktop: menu mobile nascosto, macro in colonne e news renderizzate", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });

    await page.route("**/api/news", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          news: [
            {
              ticker: "CONTESTO GLOBALE",
              titolo: "Elezioni e mercati: scenario di volatilita moderata",
              fonte: "Test Source",
              url: "https://example.com/news-1",
              data: new Date().toISOString(),
              riassunto: "Evento politico con possibile impatto su tassi, valute e sentiment.",
            },
          ],
          meta: {
            hasAssets: true,
            hasValidTickers: true,
            usedNameFallback: false,
            providerDegraded: false,
            providerErrorsCount: 0,
            usedMarketFallback: false,
            usedGlobalContext: true,
          },
        }),
      });
    });

    await page.goto("/dashboard");
    await expect(page.getByPlaceholder("Scrivi un messaggio...")).toBeVisible({ timeout: 30_000 });

    await expect(page.getByTestId("mobile-actions-menu-button")).toHaveCount(0);
    await expect(page.getByTestId("mobile-actions-menu")).toHaveCount(0);

    const macroCards = page
      .locator("div")
      .filter({ hasText: /^Contesto di mercato$/ })
      .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]")
      .locator("div.rounded-lg");
    const macroCount = await macroCards.count();
    if (macroCount >= 2) {
      const first = await macroCards.nth(0).boundingBox();
      const second = await macroCards.nth(1).boundingBox();
      expect(first && second).toBeTruthy();
      if (first && second) {
        expect(Math.abs(first.y - second.y)).toBeLessThan(24);
      }
    }

    await expect(page.getByRole("link", { name: "Leggi articolo" }).first()).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("Auth recovery dashboard", () => {
  test("senza sessione valida, redirect pulito al login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login(\?|$)/, { timeout: 20_000 });
  });
});
