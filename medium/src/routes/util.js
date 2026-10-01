'use strict';
const { UserError } = require('../services/common');

function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Silakan masuk dulu.' });
  next();
}
function requireOwner(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Silakan masuk dulu.' });
  if (req.user.role !== 'pemilik') return res.status(403).json({ error: 'Hanya pemilik yang boleh melakukan ini.' });
  next();
}
/** Simple in-memory limiter per IP. */
function rateLimit({ max, windowMs, message }) {
  const hits = new Map();
  return (req, res, next) => {
    if (process.env.DISABLE_RATE_LIMIT === '1') return next();
    const key = req.ip;
    const nowMs = Date.now();
    const list = (hits.get(key) || []).filter((t) => nowMs - t < windowMs);
    if (list.length >= max) return res.status(429).json({ error: message || 'Terlalu banyak percobaan. Tunggu sebentar.' });
    list.push(nowMs);
    hits.set(key, list);
    next();
  };
}
const id = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new UserError('Data tidak ditemukan.', 404);
  return n;
};
module.exports = { requireUser, requireOwner, rateLimit, id };
