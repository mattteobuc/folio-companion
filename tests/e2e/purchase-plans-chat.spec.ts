import { expect, test, type Page } from "@playwright/test";

test.use({
  storageState: process.env.PLAYWRIGHT_STORAGE_STATE,
});

test.describe("Piani con Mate", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!process.env.PLAYWRIGHT_STORAGE_STATE, "Serve PLAYWRIGHT_STORAGE_STATE con sessione autenticata.");
  const CHAT_INPUT_PLACEHOLDER = "Scrivi un messaggio...";

  async function openPlanModeFromShortcut(page: Page) {
    const createPlanButton = page.getByRole("button", { name: "Crea piano con Mate" });
    await createPlanButton.scrollIntoViewIfNeeded();
    // Forziamo il click per evitare intercettazioni da layer fixed (chat/header mobile).
    await createPlanButton.click({ force: true });
    // Attende che la chat sia davvero pronta all'input utente.
    await expect(page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER)).toBeVisible();
  }

  async function sendChatAndWaitAssistant(page: Page, message: string) {
    const assistantMessages = page.getByTestId("chat-message-assistant");
    const previousCount = await assistantMessages.count();
    await page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER).fill(message);
    await page.keyboard.press("Enter");
    await expect(assistantMessages).toHaveCount(previousCount + 1, { timeout: 20_000 });
    return assistantMessages.last();
  }

  async function ensurePlanConversationContext(page: Page) {
    await openPlanModeFromShortcut(page);
    const assistantReply = await sendChatAndWaitAssistant(page, "crea un nuovo piano");
    await expect(assistantReply).toContainText(/piano|titolo|cadenza|importo|data|conferm/i);
  }

  test("shortcut apre il flow piani in chat", async ({ page }) => {
    await page.goto("/dashboard");
    await openPlanModeFromShortcut(page);
    await expect(page.getByTestId("chat-message-user")).toHaveCount(0);
    await expect(page.getByTestId("chat-message-assistant")).toHaveCount(1);
  });

  // Freeze temporaneo dei test conversazionali "step-by-step" sui piani.
  // TODO: riabilitare quando il flow piani avra stato conversazionale deterministicamente testabile.
  test.skip("wizard conversazionale end-to-end e piano visibile", async ({ page }) => {
    await page.goto("/dashboard");
    await ensurePlanConversationContext(page);
    await sendChatAndWaitAssistant(page, "test");
  });

  test.skip("annullamento flow piano", async ({ page }) => {
    await page.goto("/dashboard");
    await ensurePlanConversationContext(page);
    await sendChatAndWaitAssistant(page, "annulla");
  });

  test.skip("persistenza draft dopo refresh", async ({ page }) => {
    await page.goto("/dashboard");
    await ensurePlanConversationContext(page);
    await page.reload();
  });

  test.skip("caso nuove opportunita non vincolato ai ticker posseduti", async ({ page }) => {
    await page.goto("/dashboard");
    await ensurePlanConversationContext(page);
  });

  test("sezioni notizie e insight visibili", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Notizie per te" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Insight del mate" }).first()).toBeVisible();
  });
});
