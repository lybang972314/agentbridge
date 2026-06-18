// Database — SQLite persistence for users, subscriptions, and API keys

import Database, { type Database as DatabaseType } from "better-sqlite3";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
mkdirSync(DATA_DIR, { recursive: true });

const db: DatabaseType = new Database(join(DATA_DIR, "gateway.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    stripe_customer_id TEXT UNIQUE,
    subscription_status TEXT DEFAULT 'inactive',
    subscription_tier TEXT DEFAULT 'free',
    daily_call_limit INTEGER DEFAULT 100,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    key TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT DEFAULT 'default',
    last_used_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

const stmtCreateUser = db.prepare(`
  INSERT INTO users (id, email, api_key, stripe_customer_id, subscription_status, subscription_tier)
  VALUES (?, ?, ?, ?, 'active', 'free')
`);
const stmtGetUserByApiKey = db.prepare(`SELECT * FROM users WHERE api_key = ?`);
const stmtGetUserByStripeCustomer = db.prepare(`SELECT * FROM users WHERE stripe_customer_id = ?`);
const stmtGetUserByEmail = db.prepare(`SELECT * FROM users WHERE email = ?`);
const stmtUpdateSubscription = db.prepare(`
  UPDATE users SET subscription_status = ?, subscription_tier = ?, daily_call_limit = ?, updated_at = datetime('now')
  WHERE stripe_customer_id = ?
`);

export interface User {
  id: string;
  email: string;
  api_key: string;
  stripe_customer_id: string | null;
  subscription_status: string;
  subscription_tier: string;
  daily_call_limit: number;
}

export function createUser(email: string, stripeCustomerId: string | null, apiKey: string): User {
  const id = crypto.randomUUID();
  stmtCreateUser.run(id, email, apiKey, stripeCustomerId);
  return { id, email, api_key: apiKey, stripe_customer_id: stripeCustomerId, subscription_status: 'active', subscription_tier: 'free', daily_call_limit: 100 };
}

export function getUserByApiKey(apiKey: string): User | undefined {
  return stmtGetUserByApiKey.get(apiKey) as User | undefined;
}

export function getUserByStripeCustomer(customerId: string): User | undefined {
  return stmtGetUserByStripeCustomer.get(customerId) as User | undefined;
}

export function getUserByEmail(email: string): User | undefined {
  return stmtGetUserByEmail.get(email) as User | undefined;
}

export function updateSubscription(customerId: string, status: string, tier: string, dailyLimit: number): void {
  stmtUpdateSubscription.run(status, tier, dailyLimit, customerId);
}

export default db;
