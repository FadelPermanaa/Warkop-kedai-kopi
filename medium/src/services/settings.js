'use strict';
const { db } = require('../db');

const DEFAULTS = {
  shop_name: 'Warkop Kita',
  shop_tagline: 'Kedai kopi & Indomie',
  shop_address: 'Jl. Merdeka No. 17, Bandung',
  shop_phone: '',
  open_time: '06:00',
  close_time: '23:00',
  receipt_footer: 'Terima kasih, sampai ketemu lagi!',
  qris_image: '',           // data URL of the shop's static QRIS (uploaded by the owner)
  qris_name: '',
  table_ordering: '1',      // customers can order from the table QR
  public_url: '',           // full address for the table QR codes, e.g. https://kasir.warkopkita.id
};

function get(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : DEFAULTS[key] ?? '';
}
function all() {
  const out = { ...DEFAULTS };
  for (const r of db.prepare('SELECT key, value FROM settings').all()) out[r.key] = r.value;
  return out;
}
function set(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
}
const bool = (key) => get(key) === '1';

module.exports = { DEFAULTS, get, all, set, bool };
