import { expect, test } from "@playwright/test";

test.use({
  storageState: process.env.PLAYWRIGHT_STORAGE_STATE,
});

const CHAT_INPUT_PLACEHOLDER = "Scrivi un messaggio...";

test.describe("Mate — onboarding chat-first", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(!process.env.PLAYWRIGHT_STORAGE_STATE, "Serve PLAYWRIGHT_STORAGE_STATE con sessione autenticata.");

  test("chat libera: messaggio durante / dopo caricamento dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER)).toBeVisible({ timeout: 25_000 });
    const assistant = page.getByTestId("chat-message-assistant");
    const countBefore = await assistant.count();
    await page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER).fill(
      "In una frase molto breve: cosa sono i tassi di interesse per un risparmiatore? Solo contesto, niente consigli operative.",
    );
    await page.keyboard.press("Enter");
    await expect(assistant).toHaveCount(countBefore + 1, { timeout: 35_000 });
    await expect(assistant.last()).not.toBeEmpty();
  });

  test("onboarding: kickoff, quick reply, completamento e non ripartenza al refresh", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER)).toBeVisible({ timeout: 25_000 });
    const kickoff = page.getByText(/3 domande rapide|30\s*secondi/i);
    const kickoffVisible = await kickoff.isVisible({ timeout: 12_000 }).catch(() => false);
    if (!kickoffVisible) {
      test.skip(true, "Kickoff assente: profilo già completato/saltato oppure tabella profilo non disponibile.");
    }

    const quick = page.getByTestId("mate-quick-replies");
    await expect(quick).toBeVisible({ timeout: 15_000 });

    await quick.getByRole("button", { name: "Crescita", exact: true }).click();
    await expect(page.getByTestId("chat-message-user").filter({ hasText: "Crescita" })).toBeVisible({ timeout: 15_000 });
    await expect(quick.getByRole("button", { name: "<1 anno", exact: true })).toBeVisible({ timeout: 25_000 });

    await quick.getByRole("button", { name: "<1 anno", exact: true }).click();
    await expect(quick.getByRole("button", { name: "Bassa", exact: true })).toBeVisible({ timeout: 25_000 });

    await quick.getByRole("button", { name: "Bassa", exact: true }).click();
    await expect(quick.getByRole("button", { name: "Diretto", exact: true })).toBeVisible({ timeout: 25_000 });

    await quick.getByRole("button", { name: "Diretto", exact: true }).click();

    const assistant = page.getByTestId("chat-message-assistant");
    await expect(assistant.last()).toBeVisible({ timeout: 35_000 });
    await expect(assistant.last()).toContainText(/profilo|capito|preferenze|obiettivo|tolleranza|stile/i);

    await page.reload();
    await expect(page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER)).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText(/3 domande rapide|30\s*secondi/i)).toHaveCount(0);

    const countAfterReload = await assistant.count();
    await page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER).fill("Grazie, torniamo alla chat normale.");
    await page.keyboard.press("Enter");
    await expect(assistant).toHaveCount(countAfterReload + 1, { timeout: 35_000 });
  });

  test("onboarding: salta per ora (solo con E2E_MATE_ONBOARDING_SKIP=1 e profilo not_started)", async ({ page }) => {
    test.skip(
      process.env.E2E_MATE_ONBOARDING_SKIP !== "1",
      "Imposta E2E_MATE_ONBOARDING_SKIP=1 su un utente test con onboarding non completato.",
    );
    await page.goto("/dashboard");
    await expect(page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER)).toBeVisible({ timeout: 25_000 });
    const kickoff = page.getByText(/3 domande rapide|30\s*secondi/i);
    await expect(kickoff).toBeVisible({ timeout: 15_000 });
    const quick = page.getByTestId("mate-quick-replies");
    await quick.getByRole("button", { name: "Salta per ora", exact: true }).click();
    await expect(page.getByText(/saltiamo la profilazione/i)).toBeVisible({ timeout: 25_000 });
    await expect(page.getByTestId("mate-quick-replies")).toHaveCount(0);

    await page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER).fill("Ok, parliamo di contesto macro generico.");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("chat-message-assistant").last()).toBeVisible({ timeout: 35_000 });
  });
});
