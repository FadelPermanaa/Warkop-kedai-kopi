'use strict';
process.env.TZ = process.env.TZ || 'Asia/Jakarta';
const app = require('./src/app');
const settings = require('./src/services/settings');

const PORT = Number(process.env.PORT) || 3300;
app.listen(PORT, () => {
  console.log('');
  console.log(`  ${settings.get('shop_name')} — Kasir Warkop`);
  console.log(`  Buka di browser : http://localhost:${PORT}`);
  console.log('  Akun pertama    : pemilik / pemilik123  (ganti di menu Staf)');
  console.log('');
});
