import { type Page } from "@playwright/test";

/**
 * Utilitários partilhados entre testes E2E.
 * Em modo dev (VITE_USE_DEV_AUTH=true), o utilizador já está autenticado
 * — não há login a fazer. Se a app mostrar ecrã de onboarding (sem equipa),
 * os helpers abaixo criam uma equipa de teste para desbloquear o dashboard.
 */

export async function waitForAppReady(page: Page) {
  // Aguarda que a app carregue (spinner desaparece, conteúdo principal aparece)
  await page.waitForLoadState("networkidle", { timeout: 15_000 });
}

export async function ensureTeamExists(page: Page) {
  // Se aparecer o ecrã de onboarding, cria uma equipa de teste
  const isOnboarding = await page.locator('[data-testid="onboarding"]').isVisible().catch(() => false);
  if (!isOnboarding) return;

  await page.getByRole("tab", { name: /criar equipa/i }).click();
  await page.getByLabel(/nome da equipa/i).fill("Equipa de Teste");
  await page.getByLabel(/clube/i).fill("Clube Teste");
  await page.getByLabel(/categoria/i).fill("Sénior Feminino");
  await page.getByRole("button", { name: /criar equipa/i }).click();
  await page.waitForURL("**/");
}
