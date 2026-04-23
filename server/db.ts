import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "@shared/schema";

const url = process.env.DATABASE_URL ?? "./volleyiq.db";
const sqlite = new Database(url);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;

// Aplica as migrações SQL (drizzle/*.sql) no arranque. Em containers efémeros
// (ex: Railway sem volume) o ficheiro SQLite está vazio a cada redeploy, pelo
// que isto garante que as tabelas existem antes da primeira query. `migrate` é
// idempotente — se a DB já tem as migrações aplicadas, não faz nada.
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(here, "../drizzle");
migrate(db, { migrationsFolder });

// Auto-ALTER para colunas novas sem exigir drizzle-kit em dev.
function addColumnIfMissing(table: string, column: string, ddl: string) {
  const info = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  if (!info.length) return; // tabela ainda não criada por drizzle-kit
  if (info.some((c) => c.name === column)) return;
  sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
addColumnIfMissing("matches", "video_url", "video_url text");
addColumnIfMissing("actions", "video_time_sec", "video_time_sec integer");
