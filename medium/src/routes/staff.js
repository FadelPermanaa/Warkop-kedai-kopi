'use strict';
const express = require('express');
const menu = require('../services/menu');
const tables = require('../services/tables');
const settings = require('../services/settings');
const { db } = require('../db');
const stock = require('../services/stock');
const shifts = require('../services/shifts');
const audit = require('../services/audit');
const { requireUser, id } = require('./util');

const router = express.Router();
router.use(requireUser);

router.get('/menu', (req, res) => res.json(menu.menu()));
router.get('/shop', (req, res) => {
  const s = settings.all();
  res.json({ name: s.shop_name, tagline: s.shop_tagline, address: s.shop_address, phone: s.shop_phone, footer: s.receipt_footer, qris: !!s.qris_image, qris_name: s.qris_name });
});

router.get('/shop/qris', (req, res) => res.json({ image: settings.get('qris_image'), name: settings.get('qris_name') }));

router.get('/incoming/count', (req, res) => {
  res.json({ pending: db.prepare("SELECT COUNT(*) n FROM table_requests WHERE status = 'pending'").get().n });
});

// ---- stock
router.get('/stock', (req, res) => res.json({ products: menu.products(), moves: stock.moves({ limit: 150 }), reasons: stock.REASONS }));
router.post('/stock/:id', (req, res) => {
  const b = req.body || {};
  if (b.mode !== 'masuk' && req.user.role !== 'pemilik') return res.status(403).json({ error: 'Hanya pemilik yang bisa mengoreksi stok.' });
  const pid = id(req.params.id);
  const after = stock.adjust(pid, b, req.user.id);
  audit.audit(req.user.id, 'stok.' + b.mode, `${menu.product(pid).name}: ${b.qty} → sisa ${after}`);
  res.json({ product: menu.product(pid) });
});

// ---- cash drawer (buka / tutup kas)
router.get('/shift', (req, res) => res.json({ shift: shifts.current() }));
router.post('/shift/open', (req, res) => {
  const s = shifts.open((req.body || {}).opening_cash, req.user.id);
  audit.audit(req.user.id, 'kas.buka', `modal ${s.opening_cash}`);
  res.json({ shift: s });
});
router.post('/shift/close', (req, res) => {
  const s = shifts.close((req.body || {}).counted_cash, (req.body || {}).note, req.user.id);
  audit.audit(req.user.id, 'kas.tutup', `seharusnya ${s.expected_cash}, dihitung ${s.counted_cash}, selisih ${s.counted_cash - s.expected_cash}`);
  res.json({ shift: s });
});

module.exports = router;
