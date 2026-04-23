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
