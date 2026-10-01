'use strict';
// First-run data: the owner account, tables and the menu from the Basic version.
const { db, tx, now } = require('./db');
const auth = require('./services/auth');
const tables = require('./services/tables');

const CATEGORIES = ['Kopi', 'Non-Kopi', 'Makanan', 'Camilan'];
// Same menu as basic/js/menu.js
const MENU = [
  ['Kopi', 'Kopi Tubruk', 'Kopi hitam kental khas warkop, ampas di bawah.', 5000, 'Klasik'],
  ['Kopi', 'Kopi Susu', 'Kopi hitam dengan susu kental manis.', 6000, ''],
  ['Kopi', 'Es Kopi Susu Gula Aren', 'Espresso, susu segar dan gula aren cair.', 15000, 'Favorit'],
  ['Kopi', 'Sanger Aceh', 'Kopi saring Aceh dengan sedikit susu.', 8000, ''],
  ['Kopi', 'Kopi Jahe', 'Kopi hitam dengan jahe hangat.', 7000, ''],
  ['Kopi', 'Manual Brew V60', 'Biji kopi Nusantara pilihan, diseduh manual.', 18000, 'Baru'],
  ['Non-Kopi', 'Teh Manis', 'Panas atau dingin.', 4000, ''],
  ['Non-Kopi', 'Teh Tarik', 'Teh susu yang ditarik sampai berbusa.', 8000, ''],
  ['Non-Kopi', 'Susu Jahe', 'Susu hangat dengan jahe merah.', 8000, ''],
  ['Non-Kopi', 'Es Jeruk', 'Jeruk peras segar.', 7000, ''],
  ['Non-Kopi', 'Cokelat', 'Cokelat panas atau dingin.', 10000, ''],
  ['Makanan', 'Indomie Goreng Telur', 'Indomie goreng, telur ceplok, sawi.', 12000, 'Favorit'],
  ['Makanan', 'Indomie Kuah Telur', 'Indomie rebus, telur, cabai rawit.', 12000, ''],
  ['Makanan', 'Nasi Goreng', 'Nasi goreng kampung dengan telur.', 15000, ''],
  ['Makanan', 'Roti Bakar Cokelat Keju', 'Roti bakar mentega, cokelat dan keju.', 12000, ''],
  ['Camilan', 'Pisang Goreng', 'Per potong.', 2000, ''],
  ['Camilan', 'Tahu Isi', 'Per potong.', 2000, ''],
  ['Camilan', 'Bakwan', 'Per potong.', 2000, ''],
  ['Camilan', 'Rempeyek Kacang', 'Satu bungkus.', 5000, ''],
];

function ensure() {
  tx(() => {
    if (!db.prepare('SELECT 1 FROM users').get()) {
      db.prepare('INSERT INTO users (username, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
        .run('pemilik', 'Pemilik', auth.hashPassword('pemilik123'), 'pemilik', now());
    }
    if (!db.prepare('SELECT 1 FROM tables').get()) tables.setCount(10);
    if (!db.prepare('SELECT 1 FROM categories').get()) {
      const ids = {};
      CATEGORIES.forEach((c, i) => { ids[c] = Number(db.prepare('INSERT INTO categories (name, sort) VALUES (?, ?)').run(c, i + 1).lastInsertRowid); });
      MENU.forEach(([c, name, desc, price, tag], i) => {
        db.prepare('INSERT INTO products (category_id, name, description, price, tag, sort) VALUES (?, ?, ?, ?, ?, ?)')
          .run(ids[c], name, desc, price, tag, i + 1);
      });
    }
  });
}

module.exports = { ensure, MENU, CATEGORIES };
