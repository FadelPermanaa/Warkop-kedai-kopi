'use strict';
// Cash drawer per shift: opening cash, what should be in the drawer, counted cash at closing.
const { db, tx, now } = require('../db');
const { UserError, int, text } = require('./common');

const SELECT = `SELECT s.*, uo.name AS opened_by_name, uc.name AS closed_by_name FROM shifts s
  LEFT JOIN users uo ON uo.id = s.opened_by LEFT JOIN users uc ON uc.id = s.closed_by`;

/** Money taken during a shift (only bills that are still paid; voided ones were refunded). */
function totals(shiftId) {
  const rows = db.prepare(`SELECT p.method, SUM(p.amount) amount FROM payments p JOIN orders o ON o.id = p.order_id
    WHERE p.shift_id = ? AND o.status = 'paid' GROUP BY p.method`).all(shiftId);
  const by = Object.fromEntries(rows.map((r) => [r.method, r.amount]));
  const orders = db.prepare("SELECT COUNT(*) n FROM orders WHERE shift_id = ? AND status = 'paid'").get(shiftId).n;
  return { tunai: by.tunai || 0, qris: by.qris || 0, orders };
}

function withTotals(s) {
  if (!s) return null;
  const t = totals(s.id);
  return { ...s, ...t, expected: s.closed_at ? s.expected_cash : s.opening_cash + t.tunai };
}

function current() { return withTotals(db.prepare(`${SELECT} WHERE s.closed_at IS NULL ORDER BY s.id DESC LIMIT 1`).get()); }

function open(openingCash, userId) {
  return tx(() => {
    if (current()) throw new UserError('Kas sudah dibuka.');
    const cash = int(openingCash, 0);
    if (cash < 0) throw new UserError('Modal awal belum benar.');
    const id = db.prepare('INSERT INTO shifts (opened_by, opened_at, opening_cash) VALUES (?, ?, ?)').run(userId, now(), cash).lastInsertRowid;
    // Bills paid before the drawer was opened today join this shift.
    db.prepare(`UPDATE payments SET shift_id = ? WHERE shift_id IS NULL AND substr(created_at, 1, 10) = substr(?, 1, 10)`).run(id, now());
    db.prepare(`UPDATE orders SET shift_id = ? WHERE shift_id IS NULL AND status = 'paid' AND substr(paid_at, 1, 10) = substr(?, 1, 10)`).run(id, now());
    return current();
  });
}

function close(countedCash, note, userId) {
  return tx(() => {
    const s = current();
    if (!s) throw new UserError('Kas belum dibuka.');
    const counted = int(countedCash);
    if (counted === null || counted < 0) throw new UserError('Isi jumlah uang di laci.');
    db.prepare('UPDATE shifts SET closed_by = ?, closed_at = ?, expected_cash = ?, counted_cash = ?, note = ? WHERE id = ?')
      .run(userId, now(), s.expected, counted, text(note, 200), s.id);
    return get(s.id);
  });
}

function get(id) { return withTotals(db.prepare(`${SELECT} WHERE s.id = ?`).get(id)); }

function list({ from, to } = {}) {
  return db.prepare(`${SELECT} WHERE substr(s.opened_at, 1, 10) BETWEEN ? AND ? ORDER BY s.id DESC`).all(from, to).map(withTotals);
}

module.exports = { current, open, close, get, list };
