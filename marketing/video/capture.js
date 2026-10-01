// Takes the screenshots used in the video (shots/*.png) from the Basic site.
//
//   cd basic && python3 -m http.server 3400      # any static server
//   BASE_URL=http://localhost:3400 node capture.js
//
// Phone screens are 390x844 @3x, with the site's own font (Poppins) served
// from fonts/. Pick a time inside opening hours so the "open" badge shows.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'))); }

const B = process.env.BASE_URL || 'http://localhost:3400';
const shot = (name) => path.join(__dirname, 'shots', name + '.png');
const out = {};
const pct = (box) => ({ left: +((box.x + box.width / 2) / 390 * 100).toFixed(2), top: +((box.y + box.height / 2) / 844 * 100).toFixed(2) });

async function appFonts(ctx) {
  const css = fs.readFileSync(path.join(__dirname, 'fonts/poppins.css'), 'utf8').replace(/url\(([^)]+)\)/g, 'url(https://fonts.gstatic.com/local/$1)');
  await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: css }));
  await ctx.route('https://fonts.gstatic.com/local/**', (r) => r.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(path.join(__dirname, 'fonts', path.basename(new URL(r.request().url()).pathname))) }));
}
const settle = async (p, ms = 500) => { await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(ms); };
const quiet = (p) => p.addStyleTag({ content: '.toast{display:none!important} *{animation-play-state:paused!important}' });

(async () => {
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await appFonts(ctx);
  const p = await ctx.newPage();

  // Customer scanned the QR on table 4
  await p.goto(B + '/?meja=4', { waitUntil: 'networkidle' });
  await quiet(p);
  await settle(p, 800);
  await p.screenshot({ path: shot('p-home') });
  await p.evaluate(() => { for (const el of document.querySelectorAll('body *')) { const pos = getComputedStyle(el).position; if (pos === 'fixed' || pos === 'sticky') el.style.position = 'static'; } });
  await p.screenshot({ path: shot('p-home-full'), fullPage: true });
  await p.reload({ waitUntil: 'networkidle' });
  await quiet(p);
  await settle(p);

  // Menu: add 2x iced palm-sugar coffee, then an Indomie
  const fav = p.locator('[data-add="es-kopi-gula-aren"]:visible').first();
  await fav.scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollBy(0, 30));
  await settle(p);
  await p.screenshot({ path: shot('p-menu-0') });
  out.tapAdd1 = pct(await fav.boundingBox());
  await fav.click();
  await settle(p, 400);
  await p.screenshot({ path: shot('p-menu-1') });
  const again = p.locator('[data-add="es-kopi-gula-aren"]:visible').first();
  out.tapAdd2 = pct(await again.boundingBox());
  await again.click();
  await settle(p, 400);
  await p.screenshot({ path: shot('p-menu-2') });

  await p.locator('[data-tabs] button', { hasText: 'Makanan' }).click();
  const mie = p.locator('[data-add="indomie-goreng"]:visible').first();
  await settle(p, 300);
  await mie.scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollBy(0, 30));
  await settle(p);
  await p.screenshot({ path: shot('p-menu-3') });
  out.tapAdd3 = pct(await mie.boundingBox());
  await mie.click();
  await settle(p, 400);
  await p.screenshot({ path: shot('p-menu-4') });
  out.tapCart = pct(await p.locator('[data-cart-bar]').boundingBox());

  // Cart: table number came from the QR link
  await p.click('[data-cart-bar]');
  await settle(p, 700);
  await p.screenshot({ path: shot('p-cart') });
  await p.fill('[data-order-form] [name="name"]', 'Budi');
  await p.fill('[data-order-form] [name="note"]', 'Gula sedikit ya');
  await settle(p, 300);
  await p.screenshot({ path: shot('p-cart-filled') });
  out.tapSend = pct(await p.locator('[data-checkout]').boundingBox());

  // Catch the WhatsApp message instead of opening WhatsApp
  await p.evaluate(() => { window.open = (url) => { window.__wa = url; return null; }; });
  await p.click('[data-checkout]');
  const wa = await p.evaluate(() => window.__wa);
  out.waText = new URL(wa).searchParams.get('text');

  // Owner edits one line in js/menu.js (15000 -> 16000): the menu after the edit
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await appFonts(ctx2);
  await ctx2.route('**/js/menu.js', async (r) => {
    const res = await r.fetch();
    const body = (await res.text()).replace(/(id: "es-kopi-gula-aren"[^\n]*price: )15000/, '$116000');
    r.fulfill({ response: res, body });
  });
  const q = await ctx2.newPage();
  await q.goto(B + '/?meja=4', { waitUntil: 'networkidle' });
  await quiet(q);
  const fav2 = q.locator('[data-add="es-kopi-gula-aren"]:visible').first();
  await fav2.scrollIntoViewIfNeeded();
  await q.evaluate(() => window.scrollBy(0, 30));
  await settle(q);
  await q.screenshot({ path: shot('p-menu-price') });

  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'shots', 'taps.json'), JSON.stringify(out, null, 1));
  console.log('Screenshots saved in shots/', out);
})().catch((e) => { console.error(e); process.exit(1); });
