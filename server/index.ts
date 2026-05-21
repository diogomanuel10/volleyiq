import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { router } from "./routes";
import { publicRouter } from "./publicApi";
import { adminRouter } from "./adminRoutes";
import { sendPrematchReminders, sendRegistrationReminders } from "./notifications";

// Evita que uma promise rejeitada num handler derrube o processo. Em Express 4
// os erros async não são auto-propagados — sem este guarda, uma query SQL que
// falhe numa rota termina o processo e Railway entra em restart-loop.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

const app = express();
app.use(express.json({ limit: "2mb" }));

// CORS para o split-deploy (ex: Vercel -> Railway). Lê `ALLOWED_ORIGINS` como
// lista separada por vírgulas; `*` libera tudo (útil só para smoke tests).
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.length) {
    const allow =
      allowedOrigins.includes("*") || allowedOrigins.includes(origin);
    if (allow) {
      res.setHeader(
        "Access-Control-Allow-Origin",
        allowedOrigins.includes("*") ? "*" : origin,
      );
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization,Content-Type",
      );
    }
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

// Log simples de API (ignora rotas estáticas do Vite, se alguma dia servirmos).
app.use((req, _res, next) => {
  if (req.path.startsWith("/api")) {
    console.log(`[api] ${req.method} ${req.path}`);
  }
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, version: "0.1.0" });
});

// Public API — uses API key auth, NOT Firebase. Must be before requireAuth.
app.use("/api/public/v1", publicRouter);

app.use("/api/admin", adminRouter);
app.use("/api", router);

// Error handler de último recurso para erros síncronos ou chamadas `next(err)`.
// Combinado com o unhandledRejection handler no topo do ficheiro, garante que
// o processo não morre quando um handler async falha.
app.use(
  (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[api:error]", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "Internal server error" });
  },
);

// Em produção servimos o build do Vite a partir do próprio processo. Assim
// um único deploy (ex: Railway) serve cliente e API. Em dev o Vite corre
// em 5173 e faz proxy para aqui — nada a fazer.
if (process.env.NODE_ENV === "production") {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const clientDir = path.resolve(here, "../dist/client");
  if (fs.existsSync(clientDir)) {
    app.use(express.static(clientDir));
    // SPA fallback — qualquer rota que não seja /api devolve o index.html.
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(clientDir, "index.html"));
    });
    console.log(`[server] A servir cliente estático de ${clientDir}`);
  } else {
    console.warn(
      `[server] dist/client não existe — corre "npm run build" antes de "npm start".`,
    );
  }
}

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`[server] VolleyIQ em http://localhost:${port}`);
});

// ── Cron jobs (polling via setInterval) ─────────────────────────────────
// Daily at ~08:00: pre-match reminders for games in the next 24h
function scheduleDailyAt8() {
  const now = new Date();
  const next8 = new Date(now);
  next8.setHours(8, 0, 0, 0);
  if (next8 <= now) next8.setDate(next8.getDate() + 1);
  const msToNext8 = next8.getTime() - now.getTime();
  setTimeout(() => {
    sendPrematchReminders().catch(console.error);
    setInterval(() => sendPrematchReminders().catch(console.error), 24 * 60 * 60 * 1000);
  }, msToNext8);
}
scheduleDailyAt8();

// Weekly on Monday: registration reminder for inactive teams
function scheduleWeeklyMonday() {
  const now = new Date();
  const next = new Date(now);
  const daysUntilMonday = (1 - now.getDay() + 7) % 7 || 7;
  next.setDate(now.getDate() + daysUntilMonday);
  next.setHours(9, 0, 0, 0);
  const msToNext = next.getTime() - now.getTime();
  setTimeout(() => {
    sendRegistrationReminders().catch(console.error);
    setInterval(() => sendRegistrationReminders().catch(console.error), 7 * 24 * 60 * 60 * 1000);
  }, msToNext);
}
scheduleWeeklyMonday();
