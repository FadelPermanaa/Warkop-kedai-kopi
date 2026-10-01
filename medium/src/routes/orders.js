'use strict';
const express = require('express');
const orders = require('../services/orders');
const tables = require('../services/tables');
const audit = require('../services/audit');
const { db } = require('../db');
const { int } = require('../services/common');
const { requireUser, id } = require('./util');

const router = express.Router();
router.use(requireUser);
const log = (req, action, detail) => audit.audit(req.user.id, action, detail);
const owner = (req) => req.user.role === 'pemilik';

/** Tables with their open bills (for the "Meja & bon" screen and the table picker). */
router.get('/tables', (req, res) => {
  const open = orders.listOpen();
  res.json({
    tables: tables.list().map((t) => ({ id: t.id, name: t.name, orders: open.filter((o) => o.table_id === t.id) })),
    take_away: open.filter((o) => o.type === 'take_away'),
  });
});

router.get('/orders/open', (req, res) => res.json({ orders: orders.listOpen() }));
router.get('/orders', (req, res) => res.json(orders.history({ date: req.query.date, status: req.query.status, q: req.query.q })));
router.get('/orders/:id', (req, res) => {
  const o = orders.get(id(req.params.id));
  if (!o) return res.status(404).json({ error: 'Bon tidak ditemukan.' });
  res.json({ order: o });
});

router.post('/orders', (req, res) => {
  const oid = orders.open(req.body || {}, req.user.id);
  res.json({ order: orders.get(oid) });
});
router.post('/orders/:id/items', (req, res) => {
  const oid = id(req.params.id);
  orders.addItems(oid, (req.body || {}).items, req.user.id);
  res.json({ order: orders.get(oid) });
});
router.put('/orders/:id/items/:itemId', (req, res) => {
  const oid = id(req.params.id);
  const r = orders.setItemQty(oid, id(req.params.itemId), (req.body || {}).qty, req.user.id);
  if (r.before !== undefined && r.qty < r.before) log(req, 'bon.kurangi', `${r.code}: ${r.name} ${r.before} → ${r.qty}`);
  res.json({ order: orders.get(oid) });
});
router.put('/orders/:id', (req, res) => {
  const { before, after } = orders.update(id(req.params.id), req.body || {});
  if (before.discount !== after.discount) log(req, 'bon.diskon', `${after.code}: ${before.discount} → ${after.discount}`);
  res.json({ order: after });
});
router.post('/orders/:id/move', (req, res) => {
  const o = orders.move(id(req.params.id), int((req.body || {}).table_id) || null);
  log(req, 'bon.pindah', `${o.code} → ${o.label}`);
  res.json({ order: o });
});
router.post('/orders/:id/merge', (req, res) => {
  const { from, into } = orders.merge(id(req.params.id), id((req.body || {}).into));
  log(req, 'bon.gabung', `${from.code} → ${into.code}`);
  res.json({ order: into });
});
router.post('/orders/:id/split', (req, res) => {
  const oid = id(req.params.id);
  const newId = orders.split(oid, (req.body || {}).items, req.user.id);
  const o = orders.get(newId);
  log(req, 'bon.pisah', `${orders.get(oid).code} → ${o.code}`);
  res.json({ order: o, from: orders.get(oid) });
});
router.post('/orders/:id/pay', (req, res) => {
  const o = orders.pay(id(req.params.id), (req.body || {}).payments, req.user.id);
  res.json({ order: o });
});
router.post('/orders/:id/void', (req, res) => {
  if (!owner(req)) return res.status(403).json({ error: 'Hanya pemilik yang bisa membatalkan bon.' });
  const { before, after } = orders.voidOrder(id(req.params.id), (req.body || {}).reason, req.user.id);
  log(req, 'bon.batal', `${after.code} (${before.status === 'paid' ? 'sudah dibayar' : 'belum dibayar'}, ${after.total}): ${after.void_reason}`);
  res.json({ order: after });
});
router.delete('/orders/:id', (req, res) => {
  const o = orders.discardEmpty(id(req.params.id));
  log(req, 'bon.hapus-kosong', o.code);
  res.json({ ok: true });
});

/** Summary for the top of the cashier screen. */
router.get('/today', (req, res) => {
  const { summary } = orders.history({});
  const open = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(total), 0) t FROM orders WHERE status = 'open'").get();
  res.json({ ...summary, open_count: open.n, open_total: open.t });
});

module.exports = router;
