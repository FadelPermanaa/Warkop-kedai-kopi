'use strict';
// Orders sent by customers from the QR on their table. The cashier accepts them into a bill.
const crypto = require('crypto');
const { db, tx, now } = require('../db');
const { UserError, int, text } = require('./common');
const menu = require('./menu');
const orders = require('./orders');

const shape = (r) => r && ({ ...r, items: JSON.parse(r.items) });
const SELECT = `SELECT r.*, t.name AS table_name, u.name AS handled_by_name, o.code AS order_code FROM table_requests r
  JOIN tables t ON t.id = r.table_id LEFT JOIN users u ON u.id = r.handled_by LEFT JOIN orders o ON o.id = r.order_id`;

/** Customer side: validate against the live menu and store as "pending". */
function create(table, input) {
  const name = text(input.customer_name, 40);
  if (!name) throw new UserError('Tulis nama kamu dulu, ya.');
  const raw = Array.isArray(input.items) ? input.items : [];
  if (!raw.length) throw new UserError('Keranjang masih kosong.');
  if (raw.length > 30) throw new UserError('Pesanan terlalu banyak. Pesan ke kasir langsung, ya.');
  const items = raw.map((it) => {
    const p = menu.product(int(it.product_id));
    if (!p || p.deleted) throw new UserError('Ada menu yang sudah tidak ada. Muat ulang halaman.');
    if (!p.sellable) throw new UserError(`Maaf, ${p.name} sedang habis.`);
    const qty = int(it.qty);
    if (!qty || qty < 1 || qty > 20) throw new UserError(`Jumlah ${p.name} belum benar.`);
    if (p.track_stock && qty > p.stock) throw new UserError(`Maaf, ${p.name} tinggal ${p.stock}.`);
    return { product_id: p.id, name: p.name, price: p.price, qty, note: text(it.note, 80) };
  });
  const pending = db.prepare("SELECT COUNT(*) n FROM table_requests WHERE table_id = ? AND status = 'pending'").get(table.id).n;
  if (pending >= 5) throw new UserError('Masih ada pesanan dari meja ini yang belum diproses kasir. Tunggu sebentar, ya.');
  const token = crypto.randomBytes(12).toString('base64url');
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  db.prepare(`INSERT INTO table_requests (token, table_id, customer_name, note, items, total, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`).run(token, table.id, name, text(input.note, 120), JSON.stringify(items), total, now());
  return token;
}

function byToken(token) { return shape(db.prepare(`${SELECT} WHERE r.token = ?`).get(String(token || ''))); }
function get(id) { return shape(db.prepare(`${SELECT} WHERE r.id = ?`).get(id)); }

function list() {
  const pending = db.prepare(`${SELECT} WHERE r.status = 'pending' ORDER BY r.id`).all().map(shape);
  const recent = db.prepare(`${SELECT} WHERE r.status != 'pending' ORDER BY r.handled_at DESC LIMIT 15`).all().map(shape);
  return { pending, recent };
}

/** Put the request into the table's open bill (or a new one). Stock is taken here. */
function accept(id, { order_id: orderId } = {}, userId) {
  return tx(() => {
    const r = get(id);
    if (!r) throw new UserError('Pesanan tidak ditemukan.', 404);
    if (r.status !== 'pending') throw new UserError('Pesanan ini sudah diproses.');
    const items = r.items.map((i) => ({ product_id: i.product_id, qty: i.qty, note: i.note }));
    let target = int(orderId);
    if (target) {
      const o = orders.get(target);
      if (!o || o.status !== 'open') throw new UserError('Bon tujuan sudah tidak terbuka.');
      orders.addItems(target, items, userId);
    } else {
      target = orders.open({ type: 'dine_in', table_id: r.table_id, customer_name: r.customer_name, note: r.note, items, source: 'meja' }, userId);
    }
    db.prepare("UPDATE table_requests SET status = 'accepted', order_id = ?, handled_at = ?, handled_by = ? WHERE id = ?").run(target, now(), userId, id);
    return { request: get(id), order: orders.get(target) };
  });
}

function reject(id, reason, userId) {
  const r = get(id);
  if (!r) throw new UserError('Pesanan tidak ditemukan.', 404);
  if (r.status !== 'pending') throw new UserError('Pesanan ini sudah diproses.');
  db.prepare("UPDATE table_requests SET status = 'rejected', reject_reason = ?, handled_at = ?, handled_by = ? WHERE id = ?")
    .run(text(reason, 120) || 'Maaf, pesanan tidak bisa dibuat. Silakan tanya kasir.', now(), userId, id);
  return get(id);
}

module.exports = { create, byToken, get, list, accept, reject };
