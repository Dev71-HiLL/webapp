import pkg from "pg";
const { Pool } = pkg;

const DEFAULT_URL = "postgres://webapp:webpass@db:5432/webdb";
const connStr = process.env.DATABASE_URL || DEFAULT_URL;

export const pool = new Pool({
  connectionString: connStr,
  max: 5,
  idleTimeoutMillis: 30000,
});

export async function pingDB() {
  const r = await pool.query("select 1 as ok");
  return r.rows[0]?.ok === 1;
}
