'use strict';
const express = require('express');
const QRCode = require('qrcode');
const menu = require('../services/menu');
const auth = require('../services/auth');
const settings = require('../services/settings');
const tables = require('../services/tables');
const audit = require('../services/audit');
const { UserError, text } = require('../services/common');
const { requireOwner, id } = require('./util');

const router = express.Router();
router.use(requireOwner);
const log = (req, action, detail) => audit.audit(req.user.id, action, detail);

// ---- menu
router.get('/menu', (req, res) => res.json({ categories: menu.categories(), products: menu.products(), tags: menu.TAGS }));
router.post('/categories', (req, res) => { const cid = menu.saveCategory(req.body); log(req, 'kategori.simpan', req.body.name); res.json({ id: cid }); });
router.put('/categories/:id', (req, res) => { menu.saveCategory({ ...req.body, id: id(req.params.id) }); log(req, 'kategori.simpan', req.body.name); res.json({ ok: true }); });
router.delete('/categories/:id', (req, res) => { menu.deleteCategory(id(req.params.id)); log(req, 'kategori.hapus', req.params.id); res.json({ ok: true }); });
router.post('/products', (req, res) => { const pid = menu.createProduct(req.body); log(req, 'menu.tambah', req.body.name); res.json({ id: pid }); });
router.put('/products/:id', (req, res) => {
  const { before, after } = menu.updateProduct(id(req.params.id), req.body);
  if (before.price !== after.price) log(req, 'menu.harga', `${after.name}: ${before.price} → ${after.price}`);
  else log(req, 'menu.ubah', after.name);
  res.json({ product: after });
});
router.delete('/products/:id', (req, res) => { menu.deleteProduct(id(req.params.id)); log(req, 'menu.hapus', req.params.id); res.json({ ok: true }); });

// ---- staff
router.get('/users', (req, res) => res.json({ users: auth.listUsers() }));
router.post('/users', (req, res) => { const uid = auth.createUser(req.body); log(req, 'staf.tambah', req.body.username); res.json({ id: uid }); });
router.put('/users/:id', (req, res) => { auth.updateUser(id(req.params.id), req.body, req.user.id); log(req, 'staf.ubah', req.params.id); res.json({ ok: true }); });

// ---- settings
const EDITABLE = ['shop_name', 'shop_tagline', 'shop_address', 'shop_phone', 'open_time', 'close_time', 'receipt_footer', 'qris_name', 'table_ordering', 'public_url'];
router.get('/settings', (req, res) => res.json({ settings: settings.all(), tables: tables.list() }));
router.put('/settings', (req, res) => {
  const b = req.body || {};
  for (const k of EDITABLE) if (b[k] !== undefined) settings.set(k, text(b[k], k === 'receipt_footer' ? 200 : 120));
  if (b.qris_image !== undefined) {
    const img = String(b.qris_image);
    if (img && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(img)) throw new UserError('Gambar QRIS harus PNG, JPG atau WEBP.');
    if (img.length > 2_000_000) throw new UserError('Gambar QRIS terlalu besar (maks. ±1,5 MB).');
    settings.set('qris_image', img);
  }
  if (b.table_count !== undefined) tables.setCount(b.table_count);
  log(req, 'pengaturan.ubah', Object.keys(b).join(', '));
  res.json({ settings: settings.all(), tables: tables.list() });
});
router.put('/tables/:id', (req, res) => { tables.rename(id(req.params.id), req.body.name); res.json({ ok: true }); });
router.post('/tables/:id/reset-qr', (req, res) => { tables.resetToken(id(req.params.id)); log(req, 'meja.qr-baru', req.params.id); res.json({ ok: true }); });

/** QR codes for every table, as SVG, pointing at the customer's ordering page. */
router.get('/table-qr', async (req, res) => {
  const base = (settings.get('public_url') || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  const out = [];
  for (const t of tables.list()) {
    const url = `${base}/m/${t.token}`;
    out.push({ id: t.id, name: t.name, url, svg: await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }) });
  }
  res.json({ tables: out, shop: settings.get('shop_name') });
});

router.get('/audit', (req, res) => res.json({ entries: audit.list({ limit: 300 }) }));

module.exports = router;
