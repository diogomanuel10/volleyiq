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

// Corre as migrações SQL (drizzle/*.sql) no arranque. Idempotente — se a DB
// já tem as migrações aplicadas, não faz nada. Crítico para primeiros
// deploys em que a DB existe mas está vazia.
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(here, "../drizzle");
await migrate(db, { migrationsFolder });

// Belt-and-suspenders: aplica diretamente as colunas/tabelas novas com
// IF NOT EXISTS, independente do estado do sistema de migrações Drizzle.
// Seguro correr múltiplas vezes — nunca destrói dados existentes.
try {
  await client`ALTER TABLE players ADD COLUMN IF NOT EXISTS photo_url text`;
  await client`
    CREATE TABLE IF NOT EXISTS boards (
      id text PRIMARY KEY,
      team_id text NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      name text NOT NULL,
      description text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `;
  await client`CREATE INDEX IF NOT EXISTS boards_team_idx ON boards (team_id)`;
  await client`
    CREATE TABLE IF NOT EXISTS board_slides (
      id text PRIMARY KEY,
      board_id text NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      title text NOT NULL DEFAULT '',
      position integer NOT NULL DEFAULT 0,
      background text NOT NULL DEFAULT '#1e293b',
      elements_json text NOT NULL DEFAULT '[]',
      created_at timestamp NOT NULL DEFAULT now()
    )
  `;
  await client`CREATE INDEX IF NOT EXISTS board_slides_board_idx ON board_slides (board_id)`;
} catch (err) {
  console.error("[db] schema bootstrap error:", err);
}
