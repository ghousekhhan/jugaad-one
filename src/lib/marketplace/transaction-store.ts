import "server-only";

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";
import { transactionSchema, type FoodTransaction } from "./checkout-types";
import { MarketplaceError } from "./provider";

type Row = { version: number; body: string };
export type TransactionRow = { version: number; transaction: FoodTransaction };
const ddl = `CREATE TABLE IF NOT EXISTS jugaad_marketplace_transactions (
  id TEXT PRIMARY KEY, owner_hash TEXT NOT NULL, version INTEGER NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jugaad_documents (
  id TEXT PRIMARY KEY, version INTEGER NOT NULL, body TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS jugaad_marketplace_owner ON jugaad_marketplace_transactions (owner_hash, created_at DESC);`;
const select = "SELECT version, body FROM jugaad_marketplace_transactions";
const insert = "INSERT INTO jugaad_marketplace_transactions (id, owner_hash, version, body, created_at) VALUES ($1, $2, 0, $3, $4)";
const update = "UPDATE jugaad_marketplace_transactions SET version = version + 1, body = $1 WHERE id = $2 AND owner_hash = $3 AND version = $4";
const byOwner = `${select} WHERE owner_hash = $1 ORDER BY created_at DESC LIMIT 15`;
const byId = `${select} WHERE id = $1 AND owner_hash = $2`;

const getDocument = "SELECT version, body FROM jugaad_documents WHERE id = $1";
const addDocument = "INSERT INTO jugaad_documents (id, version, body) VALUES ($1, 0, $2) ON CONFLICT (id) DO NOTHING";
const changeDocument = "UPDATE jugaad_documents SET version = version + 1, body = $1 WHERE id = $2 AND version = $3";

interface Store {
  document(id: string): Promise<Row | undefined>;
  saveDocument(id: string, body: string, version?: number): Promise<boolean>;
  create(owner: string, transaction: FoodTransaction): Promise<void>;
  list(owner: string): Promise<TransactionRow[]>;
  get(owner: string, id: string): Promise<TransactionRow | undefined>;
  update(owner: string, row: TransactionRow, transaction: FoodTransaction): Promise<boolean>;
}

const globals = globalThis as typeof globalThis & { jugaadTransactionStore?: Promise<Store> };
function decode(row: Row): TransactionRow {
  return { version: row.version, transaction: transactionSchema.parse(JSON.parse(row.body)) };
}

export function transactionStorageConfigured() {
  return Boolean(process.env.JUGAAD_DATABASE_URL?.trim()) || process.env.NODE_ENV !== "production";
}

async function postgresStore(connectionString: string): Promise<Store> {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new MarketplaceError("TRANSACTION_STORAGE_UNAVAILABLE", 503);
  for (const key of ["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(key);
  const pool = new Pool({
    connectionString: url.toString(), max: 4, connectionTimeoutMillis: 5_000, statement_timeout: 5_000,
    ssl: { rejectUnauthorized: true, ca: process.env.JUGAAD_DATABASE_CA?.replace(/\\n/g, "\n") || undefined },
  });
  pool.on("error", () => {});
  try { await pool.query(ddl); }
  catch (error) { await pool.end(); throw error; }
  return {
    async document(id) { return (await pool.query<Row>(getDocument, [id])).rows[0]; },
    async saveDocument(id, body, version) {
      const result = version === undefined ? await pool.query(addDocument, [id, body]) : await pool.query(changeDocument, [body, id, version]);
      return result.rowCount === 1;
    },
    async create(owner, transaction) { await pool.query(insert, [transaction.id, owner, JSON.stringify(transaction), transaction.createdAt]); },
    async list(owner) { return (await pool.query<Row>(byOwner, [owner])).rows.map(decode); },
    async get(owner, id) { const { rows } = await pool.query<Row>(byId, [id, owner]); return rows[0] && decode(rows[0]); },
    async update(owner, row, transaction) { return (await pool.query(update, [JSON.stringify(transaction), transaction.id, owner, row.version])).rowCount === 1; },
  };
}

function sqliteStore(): Store {
  const file = resolve(process.env.JUGAAD_TRANSACTION_DB_PATH?.trim() || ".data/marketplace.sqlite");
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; ${ddl}`);
  const asSqlite = (sql: string) => sql.replace(/\$\d/g, "?");
  return {
    async document(id) { return db.prepare(asSqlite(getDocument)).get(id) as Row | undefined; },
    async saveDocument(id, body, version) {
      const result = version === undefined ? db.prepare(asSqlite(addDocument)).run(id, body) : db.prepare(asSqlite(changeDocument)).run(body, id, version);
      return result.changes === 1;
    },
    async create(owner, transaction) { db.prepare(asSqlite(insert)).run(transaction.id, owner, JSON.stringify(transaction), transaction.createdAt); },
    async list(owner) { return (db.prepare(asSqlite(byOwner)).all(owner) as Row[]).map(decode); },
    async get(owner, id) { const row = db.prepare(asSqlite(byId)).get(id, owner) as Row | undefined; return row && decode(row); },
    async update(owner, row, transaction) { return db.prepare(asSqlite(update)).run(JSON.stringify(transaction), transaction.id, owner, row.version).changes === 1; },
  };
}

export function transactionStore(): Promise<Store> {
  if (!transactionStorageConfigured()) throw new MarketplaceError("TRANSACTION_STORAGE_UNAVAILABLE", 503);
  globals.jugaadTransactionStore ??= (async () => {
    const connectionString = process.env.JUGAAD_DATABASE_URL?.trim();
    return connectionString ? await postgresStore(connectionString) : sqliteStore();
  })().catch(() => {
    globals.jugaadTransactionStore = undefined;
    throw new MarketplaceError("TRANSACTION_STORAGE_UNAVAILABLE", 503);
  });
  return globals.jugaadTransactionStore;
}
