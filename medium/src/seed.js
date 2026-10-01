'use strict';
// Demo data: a cashier account, stock for a few items and 30 days of sales.
//   npm run seed   (only on a database without sales; delete the "data" folder to start over)
process.env.TZ = process.env.TZ || 'Asia/Jakarta';
const { db, tx, now } = require('./db');
const defaults = require('./defaults');
const auth = require('./services/auth');

defaults.ensure();
if (db.prepare('SELECT 1 FROM orders').get()) {
  console.log('Sudah ada transaksi. Data contoh tidak ditambahkan (hapus folder "data" untuk mulai dari awal).');
  process.exit(0);
}

// Same sequence every run, so the demo looks the same everywhere.
let seed = 20261001;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const z = (n) => String(n).padStart(2, '0');
const stamp = (d, h, m, s = 0) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(h)}:${z(m)}:${z(s)}`;

tx(() => {
  if (!db.prepare("SELECT 1 FROM users WHERE username = 'kasir'").get()) {
    db.prepare("INSERT INTO users (username, name, password_hash, role, created_at) VALUES ('kasir', 'Dewi', ?, 'kasir', ?)").run(auth.hashPassword('kasir123'), now());
  }
  const owner = db.prepare("SELECT id FROM users WHERE role = 'pemilik' ORDER BY id LIMIT 1").get().id;
  const kasir = db.prepare("SELECT id FROM users WHERE username = 'kasir'").get().id;
  const products = db.prepare('SELECT * FROM products WHERE deleted = 0').all();
  const byName = (n) => products.find((p) => p.name === n);
  const tables = db.prepare('SELECT id FROM tables WHERE active = 1').all();

  // Fried snacks are counted per piece.
  for (const [name, stock, min] of [['Pisang Goreng', 40, 10], ['Tahu Isi', 8, 10], ['Bakwan', 30, 10], ['Rempeyek Kacang', 12, 5]]) {
    const p = byName(name);
    if (p) db.prepare('UPDATE products SET track_stock = 1, stock = ?, min_stock = ? WHERE id = ?').run(stock, min, p.id);
  }

  // Popular items show up more often.
  const weighted = [];
  for (const p of products) {
    const w = p.tag === 'Favorit' ? 6 : p.tag === 'Klasik' ? 5 : p.price <= 6000 ? 4 : p.price >= 15000 ? 2 : 3;
    for (let i = 0; i < w; i++) weighted.push(p);
  }
  const hours = [6, 7, 7, 8, 9, 10, 12, 13, 15, 16, 17, 19, 19, 20, 20, 21, 21, 22];

  const insOrder = db.prepare(`INSERT INTO orders (code, type, table_id, customer_name, status, source, subtotal, discount, total, opened_by, opened_at, paid_at, paid_by, void_reason, voided_at, voided_by, shift_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insItem = db.prepare('INSERT INTO order_items (order_id, product_id, name, price, qty, note, added_by, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insPay = db.prepare('INSERT INTO payments (order_id, method, amount, received, change, created_at, created_by, shift_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const names = ['', '', '', 'Budi', 'Sari', 'Andi', 'Rina', 'Joko', 'Tono', 'Mega', 'Ucok', 'Lia'];
  const notes = ['', '', '', '', 'tidak pedas', 'es sedikit', 'gula dipisah'];

  let made = 0;
  for (let back = 30; back >= 1; back--) {
    const day = new Date(); day.setDate(day.getDate() - back);
    const weekend = [0, 6].includes(day.getDay());
    const count = Math.round((weekend ? 34 : 24) + rnd() * 12);
    const cashier = back % 3 === 0 ? owner : kasir;
    const opening = 200000;
    const shiftId = Number(db.prepare('INSERT INTO shifts (opened_by, opened_at, opening_cash) VALUES (?, ?, ?)').run(cashier, stamp(day, 6, 0), opening).lastInsertRowid);
    const code = `${String(day.getFullYear()).slice(2)}${z(day.getMonth() + 1)}${z(day.getDate())}`;
    let cash = 0;
    const times = Array.from({ length: count }, () => [pick(hours), Math.floor(rnd() * 60)]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    times.forEach(([h, m], i) => {
      const takeAway = rnd() < 0.25;
      const fromQr = !takeAway && rnd() < 0.3;
      const lines = new Map();
      const n = 1 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) {
        const p = pick(weighted);
        lines.set(p.id, { p, qty: (lines.get(p.id)?.qty || 0) + (p.price <= 2000 ? 1 + Math.floor(rnd() * 3) : 1) });
      }
      const total = [...lines.values()].reduce((s, l) => s + l.p.price * l.qty, 0);
      const opened = stamp(day, h, m);
      const paid = stamp(day, Math.min(23, h + (takeAway ? 0 : 1)), takeAway ? Math.min(59, m + 5) : m);
      const voided = rnd() < 0.02;
      const oid = Number(insOrder.run(`${code}-${String(i + 1).padStart(3, '0')}`, takeAway ? 'take_away' : 'dine_in', takeAway ? null : pick(tables).id,
        takeAway ? pick(names.filter(Boolean)) : pick(names), voided ? 'void' : 'paid', fromQr ? 'meja' : 'kasir', total, total, cashier, opened, paid, cashier,
        voided ? 'Salah input' : '', voided ? paid : null, voided ? owner : null, shiftId).lastInsertRowid);
      for (const { p, qty } of lines.values()) insItem.run(oid, p.id, p.name, p.price, qty, pick(notes), cashier, opened);
      const qris = rnd() < 0.4;
      if (qris) insPay.run(oid, 'qris', total, total, 0, paid, cashier, shiftId);
      else {
        const received = [total, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000].filter((x) => x >= total)[Math.floor(rnd() * 3)] || total;
        insPay.run(oid, 'tunai', total, received, received - total, paid, cashier, shiftId);
        if (!voided) cash += total;
      }
      made++;
    });
    const expected = opening + cash;
    const diff = rnd() < 0.8 ? 0 : pick([-5000, -2000, 1000, 3000]);
    db.prepare('UPDATE shifts SET closed_by = ?, closed_at = ?, expected_cash = ?, counted_cash = ?, note = ? WHERE id = ?')
      .run(cashier, stamp(day, 23, 10), expected, expected + diff, diff ? 'Selisih uang kecil' : '', shiftId);
  }
  console.log(`Data contoh dibuat: ${made} transaksi selama 30 hari terakhir.`);
  console.log('Akun kasir contoh: kasir / kasir123');
});
