'use strict';
const crypto = require('crypto');
const { db } = require('../db');
const { UserError, text } = require('./common');

function list({ all = false } = {}) {
  return db.prepare(`SELECT * FROM tables ${all ? '' : 'WHERE active = 1'} ORDER BY sort, id`).all();
}
function byToken(token) {
  return db.prepare('SELECT * FROM tables WHERE token = ? AND active = 1').get(String(token || ''));
}
function get(id) {
  return db.prepare('SELECT * FROM tables WHERE id = ?').get(id);
}
const newToken = () => crypto.randomBytes(6).toString('base64url');

/** Make the number of active tables match `count` (adds "Meja N", deactivates extras). */
function setCount(count) {
  const n = Math.max(0, Math.min(200, Number(count) || 0));
  const rows = list({ all: true });
  rows.forEach((t, i) => {
    const active = i < n ? 1 : 0;
    if (t.active !== active) {
      if (!active && db.prepare("SELECT 1 FROM orders WHERE table_id = ? AND status = 'open'").get(t.id)) {
        throw new UserError(`${t.name} masih punya bon terbuka. Selesaikan dulu sebelum mengurangi jumlah meja.`);
      }
      db.prepare('UPDATE tables SET active = ? WHERE id = ?').run(active, t.id);
    }
  });
  for (let i = rows.length; i < n; i++) {
    db.prepare('INSERT INTO tables (name, token, sort) VALUES (?, ?, ?)').run(`Meja ${i + 1}`, newToken(), i + 1);
  }
}
function rename(id, name) {
  const n = text(name, 30);
  if (!n) throw new UserError('Nama meja wajib diisi.');
  db.prepare('UPDATE tables SET name = ? WHERE id = ?').run(n, id);
}
/** New QR link for a table (old printed QR stops working). */
function resetToken(id) {
  db.prepare('UPDATE tables SET token = ? WHERE id = ?').run(newToken(), id);
}

module.exports = { list, byToken, get, setCount, rename, resetToken };
