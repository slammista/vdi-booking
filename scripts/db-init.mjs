// Esegue schema.sql contro il database indicato in DATABASE_URL.
// Uso: npm run db:init
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import "dotenv/config";

const sql = readFileSync(new URL("../schema.sql", import.meta.url), "utf-8");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

try {
  await pool.query(sql);
  console.log("Schema applicato con successo.");
} catch (err) {
  console.error("Errore durante l'applicazione dello schema:", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
