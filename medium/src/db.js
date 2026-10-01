'use strict';
// SQLite built into Node (node:sqlite) — no database server to install.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(process.env.DB_PATH || path.join(DATA_DIR, 'warkop.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');

/** Local wall-clock time ("2026-10-01 14:05:09") in the shop's timezone (TZ). */
function now() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
}
const today = () => now().slice(0, 10);

let depth = 0;
/** Run fn in a transaction; nested calls become savepoints. */
function tx(fn) {
  const name = `sp${depth}`;
  db.exec(depth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${name}`);
  depth += 1;
  try {
    const out = fn();
    depth -= 1;
    db.exec(depth === 0 ? 'COMMIT' : `RELEASE ${name}`);
    return out;
  } catch (err) {
    depth -= 1;
    db.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${name}; RELEASE ${name}`);
    throw err;
  }
}

const MIGRATIONS = [
  // 1 — everything the cashier needs
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('pemilik', 'kasir')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price INTEGER NOT NULL CHECK (price >= 0),
    tag TEXT NOT NULL DEFAULT '',
    available INTEGER NOT NULL DEFAULT 1,
    track_stock INTEGER NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 0,
    sort INTEGER NOT NULL DEFAULT 0,
    deleted INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE tables (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('dine_in', 'take_away')),
    table_id INTEGER REFERENCES tables(id),
    customer_name TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('open', 'paid', 'void')),
    source TEXT NOT NULL DEFAULT 'kasir',
    subtotal INTEGER NOT NULL DEFAULT 0,
    discount INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    opened_by INTEGER REFERENCES users(id),
    opened_at TEXT NOT NULL,
    paid_at TEXT,
    paid_by INTEGER REFERENCES users(id),
    void_reason TEXT NOT NULL DEFAULT '',
    voided_at TEXT,
    voided_by INTEGER REFERENCES users(id),
    shift_id INTEGER
  );
  CREATE INDEX orders_status ON orders(status, table_id);
  CREATE INDEX orders_paid_at ON orders(paid_at);
  CREATE TABLE order_items (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    qty INTEGER NOT NULL CHECK (qty > 0),
    note TEXT NOT NULL DEFAULT '',
    added_by INTEGER REFERENCES users(id),
    added_at TEXT NOT NULL
  );
  CREATE INDEX order_items_order ON order_items(order_id);
  CREATE TABLE payments (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    method TEXT NOT NULL CHECK (method IN ('tunai', 'qris')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    received INTEGER NOT NULL DEFAULT 0,
    change INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    shift_id INTEGER
  );
  CREATE INDEX payments_created ON payments(created_at);
  CREATE TABLE table_requests (
    id INTEGER PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    table_id INTEGER NOT NULL REFERENCES tables(id),
    customer_name TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    items TEXT NOT NULL,
    total INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
    reject_reason TEXT NOT NULL DEFAULT '',
    order_id INTEGER REFERENCES orders(id),
    created_at TEXT NOT NULL,
    handled_at TEXT,
    handled_by INTEGER REFERENCES users(id)
  );
  CREATE TABLE stock_moves (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    ref TEXT NOT NULL DEFAULT '',
    stock_after INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id)
  );
  CREATE TABLE shifts (
    id INTEGER PRIMARY KEY,
    opened_by INTEGER NOT NULL REFERENCES users(id),
    opened_at TEXT NOT NULL,
    opening_cash INTEGER NOT NULL DEFAULT 0,
    closed_by INTEGER REFERENCES users(id),
    closed_at TEXT,
    expected_cash INTEGER,
    counted_cash INTEGER,
    note TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT ''
  );
  `,
];

function migrate() {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (let v = current; v < MIGRATIONS.length; v++) {
    tx(() => {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
}
migrate();

module.exports = { db, tx, now, today, DATA_DIR };
