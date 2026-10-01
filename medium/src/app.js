'use strict';
const path = require('path');
const express = require('express');
const auth = require('./services/auth');
const { UserError } = require('./services/common');
const defaults = require('./defaults');

defaults.ensure();

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY);

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
  });
  next();
});
app.use(express.json({ limit: '3mb' }));

// Cookie session
const COOKIE = 'wk_sid';
function readCookie(req, name) {
  const m = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
app.use((req, res, next) => {
  req.sessionToken = readCookie(req, COOKIE);
  req.user = auth.userForToken(req.sessionToken);
  next();
});
app.locals.setSession = (res, token) => {
  const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  res.set('Set-Cookie', token
    ? `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${14 * 86400}${secure}`
    : `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
};

// CSRF: state-changing API calls must be JSON from this site. Browsers cannot send
// a cross-site JSON request without a CORS preflight, which we never allow.
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!req.is('application/json')) return res.status(415).json({ error: 'Permintaan harus berformat JSON.' });
  const origin = req.get('origin');
  if (origin && new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Asal permintaan tidak dikenal.' });
  next();
});

app.use('/api', require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api', require('./routes/staff'));
app.use('/api', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Alamat API tidak ditemukan.' }));

// Pages
const PUBLIC = path.join(__dirname, '..', 'public');
app.get('/', (req, res) => res.redirect(req.user ? '/kasir' : '/login'));
app.get('/m/:token', (req, res) => res.sendFile(path.join(PUBLIC, 'pesan.html')));
for (const page of ['login', 'kasir', 'meja', 'masuk', 'riwayat', 'menu', 'stok', 'laporan', 'staf', 'pengaturan', 'qr-meja', 'struk']) {
  app.get('/' + page, (req, res, next) => res.sendFile(path.join(PUBLIC, page + '.html'), (err) => err && next(err.status === 404 ? undefined : err)));
}
app.use(express.static(PUBLIC, { index: false, extensions: ['html'] }));
app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC, '404.html')));

// Errors
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err instanceof UserError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Data yang dikirim tidak terbaca.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Data terlalu besar.' });
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan di server. Coba lagi.' });
});

module.exports = app;
