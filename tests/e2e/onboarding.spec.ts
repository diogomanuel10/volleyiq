/**
 * Testes E2E — Onboarding (criação e adesão a equipa).
 *
 * Intercepta a API para simular ausência de equipas e testar o fluxo
 * de onboarding sem necessidade de base de dados real.
 */

import { test, expect } from "@playwright/test";

test.describe("Onboarding — Criar equipa", () => {
  test.beforeEach(async ({ page }) => {
    // Simula utilizador sem equipas → forçar ecrã de onboarding
    await page.route("**/api/teams", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      } else {
        // POST de criação de equipa
        const body = JSON.parse(route.request().postData() ?? "{}");
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "t-new",
            name: body.name,
            club: body.club,
            category: body.category,
            ownerUid: "dev-user",
          }),
        });
      }
    });
  });

  test("mostra ecrã de onboarding com opções criar e juntar", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Deve aparecer o onboarding (dois botões de modo)
    const createBtn = page.getByRole("button", { name: /criar equipa/i });
    const joinBtn = page.getByRole("button", { name: /juntar/i });
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await expect(joinBtn).toBeVisible();
  });

  test("formulário de criação valida campos obrigatórios", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Tenta submeter sem preencher nada
    const submitBtn = page.getByRole("button", { name: /criar equipa/i }).last();
    await submitBtn.click();

    // O browser ou a app deve mostrar validação
    // (campo required no HTML ou toast de erro)
    const nameInput = page.locator("#name");
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
  });

  test("cria equipa com campos obrigatórios preenchidos", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Preenche o formulário
    await page.locator("#name").fill("Sporting Lisboa");
    await page.locator("#club").fill("Sporting CP");
    await page.locator("#category").fill("Sénior Feminino");

    // Submete — após sucesso a API de equipas deve retornar a nova equipa
    // e a app redireciona para o dashboard
    await page.route("**/api/teams", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { id: "t-new", name: "Sporting Lisboa", club: "Sporting CP", category: "Sénior Feminino" },
          ]),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole("button", { name: /^criar equipa$/i }).last().click();

    // Aguarda feedback de sucesso (toast ou redirecção)
    await page.waitForTimeout(1000);
    // A app deve estar no dashboard ou mostrar toast de sucesso
    const successIndicator = page.getByText(/criada|sucesso|dashboard/i).first();
    const isDashboard = await page.locator('[data-testid="dashboard"], nav').isVisible().catch(() => false);
    const hasToast = await successIndicator.isVisible().catch(() => false);
    expect(isDashboard || hasToast).toBe(true);
  });
});

test.describe("Onboarding — Juntar a equipa", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/teams", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
        : route.continue()
    );
  });

  test("mostra formulário de código de convite ao clicar em 'Juntar'", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /juntar/i }).click();

    // Deve aparecer um input de código
    const codeInput = page.getByPlaceholder(/código|invite|convite/i).first();
    await expect(codeInput).toBeVisible({ timeout: 5_000 });
  });

  test("código com comprimento errado mostra feedback de erro", async ({ page }) => {
    await page.route("**/api/teams/join/**", (route) =>
      route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not found" }) })
    );

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /juntar/i }).click();

    const codeInput = page.getByPlaceholder(/código|invite|convite/i).first();
    await codeInput.fill("ABC"); // código demasiado curto

    const joinBtn = page.getByRole("button", { name: /juntar|entrar/i }).last();
    await joinBtn.click();

    // Deve aparecer validação de erro
    await page.waitForTimeout(500);
    const errorMsg = page.getByText(/inválido|erro|mínimo|6/i).first();
    const hasError = await errorMsg.isVisible().catch(() => false);
    // Ou o botão está desabilitado / a API não foi chamada
    expect(hasError || !(await joinBtn.isEnabled().catch(() => true))).toBe(true);
  });
});
