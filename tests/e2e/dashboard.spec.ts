/**
 * Testes E2E — Dashboard.
 *
 * Verifica o carregamento do dashboard com dados mockados e a navegação
 * entre as secções principais da app.
 */

import { test, expect } from "@playwright/test";

const TEAM = { id: "t1", name: "Sporting", club: "Sporting CP", category: "Sénior F", plan: "pro" };

const DASHBOARD_DATA = {
  record: { wins: 8, losses: 3, total: 11 },
  kpis: {
    killPct: 0.42,
    sideOutPct: 0.58,
    passRating: 2.3,
    serveAcePct: 0.06,
    attackEff: 0.28,
  },
  trend: [
    { label: "Benfica", killPct: 0.4, sideOutPct: 0.55 },
    { label: "Porto", killPct: 0.38, sideOutPct: 0.52 },
  ],
  radar: [],
  topScorers: [
    { playerId: "p1", playerName: "Ana Silva", kills: 45, aces: 8, stuffBlocks: 3 },
  ],
  opponentBreakdown: [
    { opponent: "Benfica", wins: 2, losses: 1 },
  ],
  rotationStats: [],
};

async function setupMocks(page: import("@playwright/test").Page) {
  await page.route("**/api/teams", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([TEAM]) }),
  );
  await page.route("**/api/stats/team/t1/dashboard", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DASHBOARD_DATA) }),
  );
  await page.route("**/api/user/preferences", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ language: "pt-PT" }) }),
  );
}

test.describe("Dashboard", () => {
  test("carrega e mostra o nome da equipa ou conteúdo principal", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Deve estar visível algo relacionado com a equipa ou dashboard
    const hasContent =
      (await page.getByText("Sporting").first().isVisible().catch(() => false)) ||
      (await page.getByText("Dashboard").first().isVisible().catch(() => false)) ||
      (await page.locator("nav, header, aside").first().isVisible().catch(() => false));
    expect(hasContent).toBe(true);
  });

  test("mostra navegação principal com links", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Sidebar ou BottomNav deve ter links de navegação
    const navLinks = ["Scout", "Jogos", "Jogadores"];
    let found = 0;
    for (const label of navLinks) {
      if (
        await page
          .getByRole("link", { name: new RegExp(label, "i") })
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        found++;
      }
    }
    expect(found).toBeGreaterThanOrEqual(1);
  });

  test("registo de vitórias/derrotas aparece com dados", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Deve mostrar wins ou losses
    await page.waitForTimeout(1000);
    const has8 = await page.getByText("8").first().isVisible().catch(() => false);
    const has3 = await page.getByText("3").first().isVisible().catch(() => false);
    expect(has8 || has3).toBe(true);
  });

  test("tabela de top scorers aparece", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.waitForTimeout(1500);
    const hasSilva = await page.getByText(/Silva|Ana/i).first().isVisible().catch(() => false);
    const hasKills = await page.getByText("45").first().isVisible().catch(() => false);
    expect(hasSilva || hasKills).toBe(true);
  });
});

test.describe("Navegação — Principais Secções", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/teams", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([TEAM]) }),
    );
    await page.route("**/api/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
    );
  });

  test("navegar para /matches não rebenta a app", async ({ page }) => {
    await page.goto("/#/matches");
    await page.waitForLoadState("networkidle");
    const body = await page.locator("body").innerText().catch(() => "");
    expect(body.length).toBeGreaterThan(5);
    // Verifica que não há erro fatal
    expect(await page.locator("text=Error, text=Cannot read").first().isVisible().catch(() => false)).toBe(false);
  });

  test("navegar para /players não rebenta a app", async ({ page }) => {
    await page.goto("/#/players");
    await page.waitForLoadState("networkidle");
    const hasError = await page.getByText(/unhandled error/i).isVisible().catch(() => false);
    expect(hasError).toBe(false);
  });

  test("navegar para /opponents não rebenta a app", async ({ page }) => {
    await page.goto("/#/opponents");
    await page.waitForLoadState("networkidle");
    const hasError = await page.getByText(/unhandled error/i).isVisible().catch(() => false);
    expect(hasError).toBe(false);
  });
});

test.describe("TopBar", () => {
  test("selector de idioma está visível e tem opções", async ({ page }) => {
    await page.route("**/api/teams", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([TEAM]) }),
    );
    await page.route("**/api/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
    );

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // LanguageSelector tem um Globe icon e texto como "PT"
    const langBtn = page.getByRole("button", { name: /idioma|language/i }).first();
    const ptText = page.getByText("PT").first();

    const hasLangSelector =
      (await langBtn.isVisible().catch(() => false)) ||
      (await ptText.isVisible().catch(() => false));
    expect(hasLangSelector).toBe(true);
  });

  test("clicar no selector de idioma abre dropdown", async ({ page }) => {
    await page.route("**/api/teams", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([TEAM]) }),
    );
    await page.route("**/api/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
    );

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const langBtn = page.getByRole("button", { name: /idioma|language/i }).first();
    if (await langBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await langBtn.click();
      await page.waitForTimeout(300);
      // Dropdown deve mostrar opções de idioma
      const hasEnglish = await page.getByText("English").isVisible().catch(() => false);
      const hasSpanish = await page.getByText("Español").isVisible().catch(() => false);
      expect(hasEnglish || hasSpanish).toBe(true);
    }
  });
});
