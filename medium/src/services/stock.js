'use strict';
// Stock per menu item. Only items with "hitung stok" switched on are tracked.
const { db, tx, now } = require('../db');
const { UserError, int, text } = require('./common');

const REASONS = { jual: 'Terjual', batal: 'Batal / dikembalikan', masuk: 'Stok masuk', opname: 'Hitung ulang (opname)', rusak: 'Rusak / terbuang' };

/**
 * Change a product's stock by `delta` and log it. Does nothing for untracked items.
 * A sale that would go below zero is refused with a clear message.
 */
function move(productId, delta, reason, ref, userId) {
  const p = db.prepare('SELECT id, name, track_stock, stock FROM products WHERE id = ?').get(productId);
  if (!p || !p.track_stock || !delta) return null;
  const after = p.stock + delta;
  if (after < 0) {
    throw new UserError(p.stock > 0 ? `Stok ${p.name} tinggal ${p.stock}.` : `${p.name} sedang habis.`);
  }
  db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(after, p.id);
  db.prepare('INSERT INTO stock_moves (product_id, delta, reason, ref, stock_after, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(p.id, delta, reason, ref || '', after, now(), userId ?? null);
  return after;
}

/** Restock (+n), write-off (-n) or set the counted amount (opname). */
function adjust(productId, { mode, qty, note }, userId) {
  return tx(() => {
    const p = db.prepare('SELECT * FROM products WHERE id = ? AND deleted = 0').get(productId);
    if (!p) throw new UserError('Menu tidak ditemukan.', 404);
    if (!p.track_stock) throw new UserError(`Stok ${p.name} tidak dihitung. Nyalakan "Hitung stok" di menu dulu.`);
    const n = int(qty);
    if (n === null || n < 0) throw new UserError('Jumlah belum benar.');
    let delta;
    if (mode === 'masuk') { if (!n) throw new UserError('Isi jumlah stok yang masuk.'); delta = n; }
    else if (mode === 'rusak') { if (!n) throw new UserError('Isi jumlah yang rusak / terbuang.'); delta = -n; }
    else if (mode === 'opname') delta = n - p.stock;
    else throw new UserError('Jenis perubahan stok tidak dikenal.');
    if (p.stock + delta < 0) throw new UserError(`Stok ${p.name} hanya ${p.stock}.`);
    if (delta) move(p.id, delta, mode, text(note, 100), userId);
    return db.prepare('SELECT stock FROM products WHERE id = ?').get(p.id).stock;
  });
}

function moves({ productId, limit = 200 } = {}) {
  return db.prepare(`SELECT m.*, p.name AS product_name, u.name AS user_name FROM stock_moves m
    JOIN products p ON p.id = m.product_id LEFT JOIN users u ON u.id = m.created_by
    ${productId ? 'WHERE m.product_id = ?' : ''} ORDER BY m.id DESC LIMIT ?`).all(...(productId ? [productId, limit] : [limit]));
}

module.exports = { REASONS, move, adjust, moves };
