'use strict';
// Customer pages (no login): menu for a table and sending an order to the cashier.
const express = require('express');
const tables = require('../services/tables');
const menu = require('../services/menu');
const settings = require('../services/settings');
const requests = require('../services/requests');
const { UserError } = require('../services/common');
const { rateLimit } = require('./util');

const router = express.Router();

function table(token) {
  const t = tables.byToken(token);
  if (!t) throw new UserError('QR meja ini sudah tidak berlaku. Minta QR baru ke kasir, ya.', 404);
  return t;
}

router.get('/table/:token', (req, res) => {
  const t = table(req.params.token);
  const s = settings.all();
  const { categories, products } = menu.menu();
  res.json({
    table: { name: t.name },
    shop: { name: s.shop_name, tagline: s.shop_tagline, open_time: s.open_time, close_time: s.close_time },
    ordering: s.table_ordering === '1',
    categories,
    products: products.filter((p) => p.available).map((p) => ({
      id: p.id, category_id: p.category_id, name: p.name, description: p.description, price: p.price, tag: p.tag,
      sellable: p.sellable, left: p.track_stock && p.stock <= 5 ? p.stock : null,
    })),
  });
});

router.post('/table/:token/order', rateLimit({ max: 8, windowMs: 10 * 60 * 1000, message: 'Terlalu banyak pesanan dari HP ini. Tunggu sebentar, ya.' }), (req, res) => {
  const t = table(req.params.token);
  if (!settings.bool('table_ordering')) throw new UserError('Pesan dari meja sedang ditutup. Silakan pesan ke kasir, ya.');
  const token = requests.create(t, req.body || {});
  res.json({ token });
});

router.get('/request/:token', (req, res) => {
  const r = requests.byToken(req.params.token);
  if (!r) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  res.json({
    request: {
      status: r.status, reject_reason: r.reject_reason, table_name: r.table_name, customer_name: r.customer_name,
      items: r.items.map(({ name, qty, price, note }) => ({ name, qty, price, note })), total: r.total, created_at: r.created_at, order_code: r.order_code,
    },
  });
});

module.exports = router;
