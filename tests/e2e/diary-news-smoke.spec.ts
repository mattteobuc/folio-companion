import { expect, test } from "@playwright/test";

test.use({
  storageState: process.env.PLAYWRIGHT_STORAGE_STATE,
});

test.describe("Diario e News smoke", () => {
  test.skip(!process.env.PLAYWRIGHT_STORAGE_STATE, "Serve PLAYWRIGHT_STORAGE_STATE con sessione autenticata.");

  test("diario apre draft suggerito da chat", async ({ page }) => {
    await page.goto("/checkin?source=chat&contextType=chat_reflection&draft=Tema%20emerso%3A%20volatilita");
    await expect(page.getByRole("heading", { name: "Diario del tuo percorso" })).toBeVisible();
    await expect(page.getByLabel("Foglio nota")).toContainText("Tema emerso");
    await expect(page.getByText("Taccuino")).toBeVisible();
    await expect(page.getByText("Errore caricamento diario: {}")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /storico completo/i })).toHaveCount(0);
    await expect(page.getByText("Elimina", { exact: true })).toHaveCount(0);
  });

  test("news section visibile e refresh disponibile", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Notizie per te" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Aggiorna" }).first()).toBeVisible();
    await expect(page.getByText("Nessuna notizia disponibile.")).toHaveCount(0);
    await expect(
      page.getByText(
        /Aggiungi un asset per vedere notizie contestuali|Notizie non trovate con i ticker importati|Le fonti notizie sono temporaneamente instabili|Nessuna notizia rilevante trovata ora/i,
      ),
    ).toBeVisible();
  });
});
