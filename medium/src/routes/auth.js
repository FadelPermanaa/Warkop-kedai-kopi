'use strict';
const express = require('express');
const auth = require('../services/auth');
const settings = require('../services/settings');
const { audit } = require('../services/audit');
const { rateLimit } = require('./util');

const router = express.Router();

router.post('/login', rateLimit({ max: 10, windowMs: 5 * 60 * 1000, message: 'Terlalu banyak percobaan masuk. Tunggu 5 menit.' }), (req, res) => {
  const result = auth.login(req.body.username, req.body.password);
  if (!result) {
    audit(null, 'login.gagal', { username: String(req.body.username || '').slice(0, 40) });
    return res.status(401).json({ error: 'Nama pengguna atau kata sandi salah.' });
  }
  audit(result.user.id, 'login');
  req.app.locals.setSession(res, result.token);
  res.json({ user: result.user });
});
router.post('/logout', (req, res) => {
  auth.logout(req.sessionToken);
  req.app.locals.setSession(res, null);
  res.json({ ok: true });
});
router.get('/me', (req, res) => {
  const s = settings.all();
  res.json({ user: req.user || null, shop: { name: s.shop_name, tagline: s.shop_tagline } });
});

module.exports = router;
