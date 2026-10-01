'use strict';
const express = require('express');
const menu = require('../services/menu');
const tables = require('../services/tables');
const settings = require('../services/settings');
const { db } = require('../db');
const { requireUser } = require('./util');

const router = express.Router();
router.use(requireUser);

router.get('/menu', (req, res) => res.json(menu.menu()));
router.get('/shop', (req, res) => {
  const s = settings.all();
  res.json({ name: s.shop_name, tagline: s.shop_tagline, address: s.shop_address, phone: s.shop_phone, footer: s.receipt_footer, qris: !!s.qris_image, qris_name: s.qris_name });
});

router.get('/incoming/count', (req, res) => {
  res.json({ pending: db.prepare("SELECT COUNT(*) n FROM table_requests WHERE status = 'pending'").get().n });
});

module.exports = router;
