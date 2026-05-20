import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "@shared/schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL not set. Point it at your Postgres instance (e.g. Railway " +
      "injects DATABASE_URL automatically when you link the Postgres plugin " +
      "to your service).",
  );
}

// Railway Postgres exige TLS. `require` liga mas não valida o certificado —
// suficiente para a ligação privada entre o serviço e a DB dentro da VPC do
// Railway. Para deployments self-managed em que tens o CA, passa-se o cert.
const client = postgres(url, {
  ssl: process.env.PGSSL === "disable" ? false : "require",
  max: 10,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;

// Bootstrap direto — cada statement tem o seu try/catch independente para que
// um erro num passo não impeça os seguintes. Corre antes de migrate().
console.log("[db] bootstrap start");

const bootstrapStmts: Array<[string, string]> = [
  // Tabelas que migrate() nunca criou (DB foi inicializada via drizzle-kit push)
  ["user_preferences", `CREATE TABLE IF NOT EXISTS user_preferences (
      uid text PRIMARY KEY,
      language text NOT NULL DEFAULT 'pt-PT',
      updated_at timestamp NOT NULL DEFAULT now()
    )`],
  ["push_subscriptions", `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id text PRIMARY KEY,
      uid text NOT NULL,
      team_id text REFERENCES teams(id) ON DELETE CASCADE,
      endpoint text NOT NULL UNIQUE,
      p256dh text NOT NULL,
      auth text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )`],
  ["api_keys", `CREATE TABLE IF NOT EXISTS api_keys (
      id text PRIMARY KEY,
      team_id text NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      name text NOT NULL,
      key_hash text NOT NULL UNIQUE,
      key_prefix text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      last_used_at timestamp,
      revoked_at timestamp
    )`],
  ["webhooks", `CREATE TABLE IF NOT EXISTS webhooks (
      id text PRIMARY KEY,
      team_id text NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      name text NOT NULL,
      url text NOT NULL,
      secret text,
      enabled boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now(),
      last_fired_at timestamp,
      last_status integer,
      last_error text
    )`],
  // Colunas novas em tabelas existentes
  ["teams.trial_ends_at",   `ALTER TABLE teams ADD COLUMN IF NOT EXISTS trial_ends_at timestamp`],
  ["teams.subscribed_at",   `ALTER TABLE teams ADD COLUMN IF NOT EXISTS subscribed_at timestamp`],
  ["teams.easypay_sub_id",  `ALTER TABLE teams ADD COLUMN IF NOT EXISTS easypay_subscription_id text`],
  ["teams.pdf_count",       `ALTER TABLE teams ADD COLUMN IF NOT EXISTS pdf_exports_count integer NOT NULL DEFAULT 0`],
  ["teams.pdf_month",       `ALTER TABLE teams ADD COLUMN IF NOT EXISTS pdf_exports_month text DEFAULT ''`],
  ["teams.invite_code",     `ALTER TABLE teams ADD COLUMN IF NOT EXISTS invite_code text`],
  ["players.photo_url",     `ALTER TABLE players ADD COLUMN IF NOT EXISTS photo_url text`],
  // Novas tabelas de apresentações (Fase 2)
  ["boards", `CREATE TABLE IF NOT EXISTS boards (
      id text PRIMARY KEY,
      team_id text NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      name text NOT NULL,
      description text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`],
  ["boards_idx",      `CREATE INDEX IF NOT EXISTS boards_team_idx ON boards (team_id)`],
  ["board_slides", `CREATE TABLE IF NOT EXISTS board_slides (
      id text PRIMARY KEY,
      board_id text NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      title text NOT NULL DEFAULT '',
      position integer NOT NULL DEFAULT 0,
      background text NOT NULL DEFAULT '#1e293b',
      elements_json text NOT NULL DEFAULT '[]',
      created_at timestamp NOT NULL DEFAULT now()
    )`],
  ["board_slides_idx", `CREATE INDEX IF NOT EXISTS board_slides_board_idx ON board_slides (board_id)`],
];

for (const [label, sql] of bootstrapStmts) {
  try {
    await client.unsafe(sql);
    console.log(`[db] bootstrap OK: ${label}`);
  } catch (err: any) {
    console.error(`[db] bootstrap FAIL (${label}):`, err?.message ?? err);
  }
}

// Migrações Drizzle — em try/catch para que um journal inconsistente não
// impeça o arranque. As tabelas críticas já estão garantidas pelo bootstrap.
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(here, "../drizzle");
try {
  await migrate(db, { migrationsFolder });
} catch (err: any) {
  console.error("[db] migrate error (non-fatal):", err?.message ?? err);
}
