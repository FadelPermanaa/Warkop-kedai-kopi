'use strict';
// Bills (bon): open per table or take-away, add items, move/merge/split, pay, void.
const { db, tx, now, today } = require('../db');
const { UserError, int, text } = require('./common');
const stock = require('./stock');
const menu = require('./menu');

const ORDER_SQL = `SELECT o.*, t.name AS table_name, uo.name AS opened_by_name, up.name AS paid_by_name, uv.name AS voided_by_name
  FROM orders o LEFT JOIN tables t ON t.id = o.table_id
  LEFT JOIN users uo ON uo.id = o.opened_by LEFT JOIN users up ON up.id = o.paid_by LEFT JOIN users uv ON uv.id = o.voided_by`;

function label(o) {
  if (o.type === 'take_away') return 'Bawa pulang' + (o.customer_name ? ` · ${o.customer_name}` : '');
  return (o.table_name || 'Meja') + (o.customer_name ? ` · ${o.customer_name}` : '');
}

function get(id) {
  const o = db.prepare(`${ORDER_SQL} WHERE o.id = ?`).get(id);
  if (!o) return null;
  o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(id);
  o.payments = db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY id').all(id);
  o.label = label(o);
  return o;
}
function mustGet(id) {
  const o = get(id);
  if (!o) throw new UserError('Bon tidak ditemukan.', 404);
  return o;
}
function mustBeOpen(id) {
  const o = mustGet(id);
  if (o.status !== 'open') throw new UserError(o.status === 'paid' ? 'Bon ini sudah dibayar.' : 'Bon ini sudah dibatalkan.');
  return o;
}

/** Recompute subtotal/total from the items; the discount never exceeds the subtotal. */
function recalc(id) {
  const sub = db.prepare('SELECT COALESCE(SUM(price * qty), 0) s FROM order_items WHERE order_id = ?').get(id).s;
  const o = db.prepare('SELECT discount FROM orders WHERE id = ?').get(id);
  const discount = Math.min(o.discount, sub);
  db.prepare('UPDATE orders SET subtotal = ?, discount = ?, total = ? WHERE id = ?').run(sub, discount, sub - discount, id);
}

/** Bill number per day: 261001-007 */
function nextCode() {
  const day = today().replace(/-/g, '').slice(2);
  const last = db.prepare("SELECT code FROM orders WHERE code LIKE ? ORDER BY code DESC LIMIT 1").get(day + '-%');
  const n = last ? Number(last.code.split('-')[1]) + 1 : 1;
  return `${day}-${String(n).padStart(3, '0')}`;
}

function checkTable(tableId) {
  const t = db.prepare('SELECT * FROM tables WHERE id = ? AND active = 1').get(tableId);
  if (!t) throw new UserError('Meja tidak ditemukan.');
  return t;
}

/** Validate items [{product_id, qty, note}] against the current menu. */
function cleanItems(items) {
  if (!Array.isArray(items) || !items.length) throw new UserError('Belum ada item.');
  if (items.length > 100) throw new UserError('Terlalu banyak item sekaligus.');
  return items.map((it) => {
    const p = menu.product(int(it.product_id));
    if (!p || p.deleted) throw new UserError('Ada menu yang sudah tidak ada. Muat ulang halaman.');
    const qty = int(it.qty);
    if (!qty || qty < 1 || qty > 99) throw new UserError(`Jumlah ${p.name} belum benar.`);
    if (!p.available) throw new UserError(`${p.name} sedang tidak tersedia.`);
    return { p, qty, note: text(it.note, 80) };
  });
}

function addItemsTx(orderId, items, userId) {
  const o = db.prepare('SELECT code FROM orders WHERE id = ?').get(orderId);
  for (const { p, qty, note } of cleanItems(items)) {
    stock.move(p.id, -qty, 'jual', o.code, userId);
    // Same product, same note, same price → just bump the quantity.
    const same = db.prepare('SELECT id FROM order_items WHERE order_id = ? AND product_id = ? AND note = ? AND price = ?').get(orderId, p.id, note, p.price);
    if (same) db.prepare('UPDATE order_items SET qty = qty + ? WHERE id = ?').run(qty, same.id);
    else {
      db.prepare('INSERT INTO order_items (order_id, product_id, name, price, qty, note, added_by, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(orderId, p.id, p.name, p.price, qty, note, userId ?? null, now());
    }
  }
  recalc(orderId);
}

/** New bill. `items` is optional (an empty bill can be opened for a table). */
function open({ type, table_id: tableId, customer_name: customerName, note, items, source = 'kasir' }, userId) {
  return tx(() => {
    const kind = type === 'take_away' ? 'take_away' : 'dine_in';
    let tid = null;
    if (kind === 'dine_in') {
      if (!int(tableId)) throw new UserError('Pilih meja dulu.');
      tid = checkTable(int(tableId)).id;
    }
    const id = Number(db.prepare(`INSERT INTO orders (code, type, table_id, customer_name, note, status, source, opened_by, opened_at)
      VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?)`).run(nextCode(), kind, tid, text(customerName, 40), text(note, 120), source, userId ?? null, now()).lastInsertRowid);
    if (items && items.length) addItemsTx(id, items, userId);
    return id;
  });
}

function addItems(orderId, items, userId) {
  return tx(() => { mustBeOpen(orderId); addItemsTx(orderId, items, userId); });
}

/** Change a line's quantity on an open bill (0 removes it). Stock goes back. */
function setItemQty(orderId, itemId, qty, userId) {
  return tx(() => {
    const o = mustBeOpen(orderId);
    const it = o.items.find((x) => x.id === itemId);
    if (!it) throw new UserError('Item tidak ditemukan.', 404);
    const n = int(qty);
    if (n === null || n < 0 || n > 99) throw new UserError('Jumlah belum benar.');
    if (n === it.qty) return it;
    if (it.product_id) stock.move(it.product_id, it.qty - n, n > it.qty ? 'jual' : 'batal', o.code, userId);
    if (n === 0) db.prepare('DELETE FROM order_items WHERE id = ?').run(it.id);
    else db.prepare('UPDATE order_items SET qty = ? WHERE id = ?').run(n, it.id);
    recalc(orderId);
    return { ...it, before: it.qty, qty: n, code: o.code };
  });
}

function update(orderId, input) {
  return tx(() => {
    const o = mustBeOpen(orderId);
    const fields = {
      customer_name: input.customer_name !== undefined ? text(input.customer_name, 40) : o.customer_name,
      note: input.note !== undefined ? text(input.note, 120) : o.note,
      discount: input.discount !== undefined ? Math.max(0, int(input.discount, 0)) : o.discount,
    };
    if (fields.discount > o.subtotal) throw new UserError('Diskon tidak boleh lebih dari subtotal.');
    db.prepare('UPDATE orders SET customer_name = ?, note = ?, discount = ? WHERE id = ?').run(fields.customer_name, fields.note, fields.discount, orderId);
    recalc(orderId);
    return { before: o, after: get(orderId) };
  });
}

/** Move a bill to another table, or make it take-away (tableId = null). */
function move(orderId, tableId) {
  return tx(() => {
    mustBeOpen(orderId);
    if (tableId) {
      checkTable(tableId);
      db.prepare("UPDATE orders SET type = 'dine_in', table_id = ? WHERE id = ?").run(tableId, orderId);
    } else {
      db.prepare("UPDATE orders SET type = 'take_away', table_id = NULL WHERE id = ?").run(orderId);
    }
    return get(orderId);
  });
}

/** Put all items of bill `fromId` into bill `intoId`; `fromId` disappears. */
function merge(fromId, intoId) {
  if (fromId === intoId) throw new UserError('Pilih bon lain untuk digabung.');
  return tx(() => {
    const from = mustBeOpen(fromId);
    const into = mustBeOpen(intoId);
    for (const it of from.items) {
      const same = db.prepare('SELECT id FROM order_items WHERE order_id = ? AND product_id IS ? AND note = ? AND price = ?').get(intoId, it.product_id, it.note, it.price);
      if (same) { db.prepare('UPDATE order_items SET qty = qty + ? WHERE id = ?').run(it.qty, same.id); db.prepare('DELETE FROM order_items WHERE id = ?').run(it.id); }
      else db.prepare('UPDATE order_items SET order_id = ? WHERE id = ?').run(intoId, it.id);
    }
    if (from.discount) db.prepare('UPDATE orders SET discount = discount + ? WHERE id = ?').run(from.discount, intoId);
    if (from.note) db.prepare("UPDATE orders SET note = TRIM(note || ' ' || ?) WHERE id = ?").run(from.note, intoId);
    db.prepare('UPDATE table_requests SET order_id = ? WHERE order_id = ?').run(intoId, fromId);
    db.prepare('DELETE FROM orders WHERE id = ?').run(fromId);
    recalc(intoId);
    return { from, into: get(intoId) };
  });
}

/** Move some items (with quantities) out of a bill into a new bill on the same table. */
function split(orderId, lines, userId) {
  return tx(() => {
    const o = mustBeOpen(orderId);
    if (!Array.isArray(lines) || !lines.length) throw new UserError('Pilih item yang mau dipisah.');
    const picks = [];
    for (const l of lines) {
      const it = o.items.find((x) => x.id === int(l.id));
      const qty = int(l.qty, 0);
      if (!it || qty < 0 || qty > it.qty) throw new UserError('Jumlah item yang dipisah belum benar.');
      if (qty) picks.push({ it, qty });
    }
    if (!picks.length) throw new UserError('Pilih item yang mau dipisah.');
    const left = o.items.reduce((s, it) => s + it.qty, 0) - picks.reduce((s, p) => s + p.qty, 0);
    if (left <= 0) throw new UserError('Sisakan minimal satu item di bon asal.');
    const newId = Number(db.prepare(`INSERT INTO orders (code, type, table_id, customer_name, note, status, source, opened_by, opened_at)
      VALUES (?, ?, ?, '', '', 'open', 'kasir', ?, ?)`).run(nextCode(), o.type, o.table_id, userId ?? null, now()).lastInsertRowid);
    for (const { it, qty } of picks) {
      if (qty === it.qty) db.prepare('UPDATE order_items SET order_id = ? WHERE id = ?').run(newId, it.id);
      else {
        db.prepare('UPDATE order_items SET qty = qty - ? WHERE id = ?').run(qty, it.id);
        db.prepare('INSERT INTO order_items (order_id, product_id, name, price, qty, note, added_by, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(newId, it.product_id, it.name, it.price, qty, it.note, it.added_by, it.added_at);
      }
    }
    recalc(orderId);
    recalc(newId);
    return newId;
  });
}

function currentShiftId() {
  const s = db.prepare('SELECT id FROM shifts WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1').get();
  return s ? s.id : null;
}

/**
 * Pay the whole bill. `payments` = [{method: 'tunai'|'qris', amount, received}].
 * Mixed payment = one QRIS line + one cash line. Cash may be more than due (change).
 */
function pay(orderId, payments, userId) {
  return tx(() => {
    const o = mustBeOpen(orderId);
    if (!o.items.length) throw new UserError('Bon masih kosong.');
    if (!Array.isArray(payments) || !payments.length || payments.length > 2) throw new UserError('Cara bayar belum benar.');
    const lines = payments.map((p) => {
      const method = p.method === 'qris' ? 'qris' : p.method === 'tunai' ? 'tunai' : null;
      const amount = int(p.amount);
      if (!method || !amount || amount < 1) throw new UserError('Nominal pembayaran belum benar.');
      const received = method === 'tunai' ? int(p.received, amount) : amount;
      if (received < amount) throw new UserError('Uang yang diterima kurang.');
      return { method, amount, received, change: received - amount };
    });
    if (new Set(lines.map((l) => l.method)).size !== lines.length) throw new UserError('Cara bayar belum benar.');
    const sum = lines.reduce((s, l) => s + l.amount, 0);
    if (sum !== o.total) throw new UserError(`Jumlah bayar harus pas ${o.total.toLocaleString('id-ID')}.`);
    const at = now();
    const shift = currentShiftId();
    for (const l of lines) {
      db.prepare('INSERT INTO payments (order_id, method, amount, received, change, created_at, created_by, shift_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(orderId, l.method, l.amount, l.received, l.change, at, userId ?? null, shift);
    }
    db.prepare("UPDATE orders SET status = 'paid', paid_at = ?, paid_by = ?, shift_id = ? WHERE id = ?").run(at, userId ?? null, shift, orderId);
    return get(orderId);
  });
}

/** Cancel a bill (open or paid). Stock goes back. Owner only — checked by the route. */
function voidOrder(orderId, reason, userId) {
  return tx(() => {
    const o = mustGet(orderId);
    if (o.status === 'void') throw new UserError('Bon ini sudah dibatalkan.');
    const why = text(reason, 120);
    if (!why) throw new UserError('Tulis alasan pembatalan.');
    for (const it of o.items) if (it.product_id) stock.move(it.product_id, it.qty, 'batal', o.code, userId);
    db.prepare("UPDATE orders SET status = 'void', void_reason = ?, voided_at = ?, voided_by = ? WHERE id = ?").run(why, now(), userId ?? null, orderId);
    return { before: o, after: get(orderId) };
  });
}

/** An open bill with no items can simply be thrown away (by any staff). */
function discardEmpty(orderId) {
  return tx(() => {
    const o = mustBeOpen(orderId);
    if (o.items.length) throw new UserError('Bon masih berisi item. Hanya pemilik yang bisa membatalkan.');
    db.prepare('UPDATE table_requests SET order_id = NULL WHERE order_id = ?').run(orderId);
    db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
    return o;
  });
}

function listOpen() {
  const rows = db.prepare(`${ORDER_SQL} WHERE o.status = 'open' ORDER BY o.opened_at`).all();
  const counts = db.prepare("SELECT order_id, SUM(qty) n FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE status = 'open') GROUP BY order_id").all();
  const byId = Object.fromEntries(counts.map((c) => [c.order_id, c.n]));
  return rows.map((o) => ({ ...o, label: label(o), item_count: byId[o.id] || 0 }));
}

/** Paid and cancelled bills for one day (by paid/void/open time), newest first. */
function history({ date, status, q } = {}) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : today();
  const where = ["substr(COALESCE(o.paid_at, o.voided_at, o.opened_at), 1, 10) = ?"];
  const args = [day];
  if (status === 'paid' || status === 'void') { where.push('o.status = ?'); args.push(status); }
  else where.push("o.status IN ('paid', 'void')");
  if (q) {
    where.push("(o.code LIKE ? OR o.customer_name LIKE ? OR t.name LIKE ? OR EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.name LIKE ?))");
    const like = `%${text(q, 40)}%`;
    args.push(like, like, like, like);
  }
  const rows = db.prepare(`${ORDER_SQL} WHERE ${where.join(' AND ')} ORDER BY COALESCE(o.paid_at, o.voided_at) DESC`).all(...args);
  const pays = db.prepare("SELECT order_id, GROUP_CONCAT(method) m FROM payments WHERE order_id IN (SELECT o.id FROM orders o WHERE substr(COALESCE(o.paid_at, o.voided_at, o.opened_at), 1, 10) = ?) GROUP BY order_id").all(day);
  const methods = Object.fromEntries(pays.map((p) => [p.order_id, p.m]));
  const list = rows.map((o) => ({ ...o, label: label(o), methods: methods[o.id] || '' }));
  const paid = list.filter((o) => o.status === 'paid');
  return {
    date: day,
    orders: list,
    summary: { count: paid.length, total: paid.reduce((s, o) => s + o.total, 0), void: list.length - paid.length },
  };
}

module.exports = { get, open, discardEmpty, addItems, setItemQty, update, move, merge, split, pay, voidOrder, listOpen, history, label, currentShiftId };
