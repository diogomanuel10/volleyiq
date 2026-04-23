import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { router } from "./routes";

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
        "GET,POST,PATCH,DELETE,OPTIONS",
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

app.use("/api", router);

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
