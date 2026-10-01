// Takes the Kasir Warkop screenshots used in the demo video (shots/*.png + shots/taps.json).
//
//   node capture.js
//
// Starts medium/ on a fresh database with the demo data, then drives a laptop
// (1366x768) and a phone (390x844) through a real shift. Every request that
// leaves this computer is blocked, so the screens prove the app works offline.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');

let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'))); }

const APP = path.join(__dirname, '..', '..', 'medium');
const PORT = 3310;
const B = `http://localhost:${PORT}`;
const SHOTS = path.join(__dirname, 'shots');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-video-'));
// Pick a fixed-offset zone where it is about 19:00 right now, so the screens show a busy
// evening (server and browsers share it, so dates and times agree).
const shift = ((19 - new Date().getUTCHours() + 36) % 24) - 12;
const TZ = shift === 0 ? 'UTC' : `Etc/GMT${shift > 0 ? '-' : '+'}${Math.abs(shift)}`;
const env = { ...process.env, DATA_DIR: DATA, PORT: String(PORT), TZ };
const taps = {};
const blocked = [];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function offline(ctx) {
  await ctx.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return route.continue();
    blocked.push(u.href);
    return route.abort('internetdisconnected');
  });
}
/** Centre of an element as % of the viewport, saved under `name`. */
async function mark(page, name, selector) {
  const box = await page.locator(selector).first().boundingBox();
  const vp = page.viewportSize();
  taps[name] = { left: +(100 * (box.x + box.width / 2) / vp.width).toFixed(2), top: +(100 * (box.y + box.height / 2) / vp.height).toFixed(2) };
}
async function shot(page, name) {
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
  console.log('  ', name);
}
async function api(page, method, url, body) {
  return page.evaluate(async ([m, u, b]) => (await fetch(u, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).json(), [method, url, body]);
}

(async () => {
  fs.rmSync(SHOTS, { recursive: true, force: true });
  fs.mkdirSync(SHOTS, { recursive: true });
  execSync('node --disable-warning=ExperimentalWarning src/seed.js', { cwd: APP, env, stdio: 'inherit' });
  if (await fetch(B + '/api/me').then(() => true, () => false)) throw new Error(`Port ${PORT} is already in use. Stop the other server first.`);
  const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { cwd: APP, env, stdio: 'ignore' });
  let browser;
  try {
    for (let i = 0; i < 50 && !(await fetch(B + '/api/me').then(() => true, () => false)); i++) await wait(100);
    browser = await chromium.launch();
    const lap = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1.5, timezoneId: TZ, locale: 'id-ID' });
    await offline(lap);
    const k = await lap.newPage();
    await k.goto(B + '/login');
    await k.fill('input[name=username]', 'pemilik');
    await k.fill('input[name=password]', 'pemilik123');
    await Promise.all([k.waitForURL(/kasir/), k.click('button[type=submit]')]);

    // Shift setup: drawer open, a few bills already running, fried snacks counted.
    await api(k, 'POST', '/api/shift/open', { opening_cash: 200000 });
    const menu = (await api(k, 'GET', '/api/menu')).products;
    const P = (n) => menu.find((p) => p.name === n).id;
    await api(k, 'POST', '/api/orders', { type: 'dine_in', table_id: 5, customer_name: 'Andi', items: [{ product_id: P('Nasi Goreng'), qty: 2 }, { product_id: P('Es Jeruk'), qty: 2 }] });
    await api(k, 'POST', '/api/orders', { type: 'dine_in', table_id: 2, items: [{ product_id: P('Kopi Tubruk'), qty: 2 }, { product_id: P('Pisang Goreng'), qty: 3 }] });
    await api(k, 'POST', '/api/orders', { type: 'dine_in', table_id: 8, customer_name: 'Mega', items: [{ product_id: P('Teh Tarik'), qty: 1 }, { product_id: P('Roti Bakar Cokelat Keju'), qty: 1 }] });
    await api(k, 'POST', '/api/orders', { type: 'take_away', customer_name: 'Sari', items: [{ product_id: P('Es Kopi Susu Gula Aren'), qty: 3 }] });
    await api(k, 'POST', '/api/stock/' + P('Bakwan'), { mode: 'opname', qty: 0, note: 'habis sore' });
    await api(k, 'POST', '/api/stock/' + P('Tahu Isi'), { mode: 'opname', qty: 3 });

    // ---- Scene: a cash sale at table 3
    console.log('Kasir');
    await k.goto(B + '/kasir');
    await k.waitForSelector('.tile');
    await shot(k, 'l01-kasir');
    await mark(k, 'table', '[data-table]');
    await k.selectOption('[data-table]', '3');
    await shot(k, 'l02-meja');
    const tile = (n) => `.tile:has-text("${n}")`;
    let i = 3;
    for (const n of ['Kopi Susu', 'Kopi Susu', 'Pisang Goreng', 'Teh Manis']) {
      await mark(k, 'add' + i, tile(n));
      await k.click(tile(n));
      await shot(k, `l0${i}-tambah`);
      i++;
    }
    await mark(k, 'note', '[data-note="0"]');
    await k.click('[data-note="0"]');
    await mark(k, 'chip', '[data-s="Gula sedikit"]');
    await k.click('[data-s="Gula sedikit"]');
    await shot(k, 'l07-catatan');
    await mark(k, 'noteOk', '.modal [data-ok]');
    await k.click('.modal [data-ok]');
    await shot(k, 'l08-bon');
    await mark(k, 'pay', '[data-pay]');
    await k.click('[data-pay]');
    await k.waitForSelector('[data-recv]');
    await shot(k, 'l09-bayar');
    await mark(k, 'cash', '[data-q]:nth-child(3)');
    await k.click('[data-q]:nth-child(3)');
    await shot(k, 'l10-uang');
    await mark(k, 'confirm', '[data-confirm]');
    await k.click('[data-confirm]');
    await k.waitForSelector('.done');
    await shot(k, 'l11-lunas');
    const paidId = await k.evaluate(() => new URLSearchParams(location.search).get('order'));

    const s = await lap.newPage();
    await s.setViewportSize({ width: 420, height: 760 });
    await s.goto(`${B}/struk?id=${paidId}`);
    await s.waitForSelector('.struk .total');
    await s.waitForTimeout(400);
    await s.locator('.struk').screenshot({ path: path.join(SHOTS, 'struk.png') });
    await s.close();
    await k.click('.done ~ .foot [data-close], .foot [data-close]');

    // ---- Scene: customer orders from table 7 with a phone
    console.log('Pesan dari meja');
    const qr = (await api(k, 'GET', '/api/admin/table-qr')).tables.find((t) => t.name === 'Meja 7');
    // (QR shown in the video is decorative; the phone opens this table's real link.)
    const ph = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: TZ, locale: 'id-ID' });
    await offline(ph);
    const c = await ph.newPage();
    await c.goto(B + new URL(qr.url).pathname);
    await c.waitForSelector('.c-item');
    await c.tap('[data-cat]:nth-child(2)'); // Kopi
    await shot(c, 'p01-menu');
    const item = (n) => `.c-item:has-text("${n}")`;
    await mark(c, 'pAdd1', `${item('Es Kopi Susu Gula Aren')} .c-add`);
    await c.tap(`${item('Es Kopi Susu Gula Aren')} .c-add`);
    await shot(c, 'p02-tambah');
    await mark(c, 'pAdd2', `${item('Kopi Jahe')} .c-add`);
    await c.tap(`${item('Kopi Jahe')} .c-add`);
    await shot(c, 'p03-tambah');
    await mark(c, 'pBar', '[data-cart]');
    await c.tap('[data-cart]');
    await c.fill('[data-name]', 'Rina');
    await c.fill('[data-note="0"]', 'es sedikit');
    await shot(c, 'p04-keranjang');
    await mark(c, 'pSend', '[data-send]');
    await c.tap('[data-send]');
    await c.waitForSelector('.c-status');
    await shot(c, 'p05-menunggu');

    await k.goto(B + '/masuk');
    await k.waitForSelector('[data-accept]');
    await shot(k, 'l12-masuk');
    await mark(k, 'accept', '[data-accept]');
    await k.click('[data-accept]');
    await k.waitForSelector('.toast.show');
    await shot(k, 'l13-diterima');
    await c.waitForSelector('.c-ok', { timeout: 10000 });
    await shot(c, 'p06-diterima');

    // ---- Scene: tables and bills
    console.log('Meja & bon');
    await k.goto(B + '/meja');
    await k.waitForSelector('.tcard');
    await shot(k, 'l14-meja');
    await mark(k, 'bill5', '.tcard:has-text("Meja 5") .tbill');
    await k.click('.tcard:has-text("Meja 5") .tbill');
    await k.waitForSelector('.bill-foot');
    await shot(k, 'l15-detail');

    // ---- Scene: stock
    console.log('Stok');
    await k.goto(B + '/kasir');
    await k.waitForSelector('.tile');
    await mark(k, 'camilan', '[data-cat]:last-child');
    await k.click('[data-cat]:last-child');
    await shot(k, 'l16-habis');

    // ---- Scene: closing the drawer
    console.log('Tutup kas');
    await k.goto(B + '/riwayat');
    await k.waitForSelector('[data-kas-close]');
    await shot(k, 'l17-riwayat');
    await mark(k, 'closeKas', '[data-kas-close]');
    await k.click('[data-kas-close]');
    const shift = (await api(k, 'GET', '/api/shift')).shift;
    await k.fill('.modal [data-v]', String(shift.expected - 2000));
    await k.dispatchEvent('.modal [data-v]', 'input');
    await shot(k, 'l18-tutup');

    // ---- Scene: monthly report
    console.log('Laporan');
    await k.goto(B + '/laporan');
    await k.waitForSelector('[data-p=last]');
    await k.click('[data-p=last]');
    await k.waitForTimeout(800);
    await shot(k, 'l19-laporan');
    await k.evaluate(() => document.querySelector('.vbars').scrollIntoView({ block: 'center' }));
    await shot(k, 'l20-jam');

    // Click/tap positions (% of the screen) for the cursor in stage.html
    fs.writeFileSync(path.join(SHOTS, 'taps.js'), `window.TAPS = ${JSON.stringify(taps, null, 1)};\n`);
    console.log(`\nRequests to the internet: ${blocked.length}${blocked.length ? ' → ' + [...new Set(blocked)].join(', ') : ' (everything ran offline)'}`);
  } finally {
    if (browser) await browser.close();
    server.kill();
    fs.rmSync(DATA, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
