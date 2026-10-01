'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { start, client } = require('./helpers');

let srv; let owner; let kasir; let guest;
const product = async (name) => (await owner.get('/api/menu')).data.products.find((p) => p.name === name);

test.before(async () => {
  srv = await start();
  owner = client(srv.base);
  await owner.login('pemilik', 'pemilik123');
  await owner.post('/api/admin/users', { name: 'Dewi', username: 'dewi', password: 'rahasia1', role: 'kasir' });
  kasir = client(srv.base);
  await kasir.login('dewi', 'rahasia1');
  guest = client(srv.base);
});
test.after(() => srv.close());

test('login, roles and protection', async () => {
  assert.equal((await guest.get('/api/menu')).status, 401);
  assert.equal((await guest.post('/api/login', { username: 'pemilik', password: 'salah' })).status, 401);
  assert.equal((await kasir.get('/api/admin/menu')).status, 403);
  assert.equal((await kasir.get('/api/admin/report')).status, 403);
  // CSRF: changes must be JSON from the same site
  const form = await owner.raw('POST', '/api/orders', undefined, { 'content-type': 'application/x-www-form-urlencoded' });
  assert.equal(form.status, 415);
  const cross = await owner.post('/api/orders', { type: 'take_away', customer_name: 'X' }, { origin: 'https://jahat.example' });
  assert.equal(cross.status, 403);
  // Security headers
  const page = await guest.get('/login');
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
});

test('the last owner cannot be removed', async () => {
  const me = (await owner.get('/api/me')).data.user;
  const r = await owner.put('/api/admin/users/' + me.id, { name: 'Pemilik', role: 'kasir', active: true });
  assert.equal(r.status, 400);
});

test('bill: open, add items, change qty, discount, pay cash with change', async () => {
  const kopi = await product('Kopi Susu');
  const pisang = await product('Pisang Goreng');
  let r = await kasir.post('/api/orders', { type: 'dine_in', table_id: 1, items: [{ product_id: kopi.id, qty: 2 }, { product_id: pisang.id, qty: 3, note: 'anget' }] });
  assert.equal(r.status, 200);
  let o = r.data.order;
  assert.equal(o.total, 2 * 6000 + 3 * 2000);
  assert.match(o.code, /^\d{6}-\d{3}$/);

  r = await kasir.post(`/api/orders/${o.id}/items`, { items: [{ product_id: kopi.id, qty: 1 }] });
  o = r.data.order;
  assert.equal(o.items.find((i) => i.product_id === kopi.id).qty, 3, 'same item is merged into one line');

  r = await kasir.put(`/api/orders/${o.id}/items/${o.items.find((i) => i.product_id === pisang.id).id}`, { qty: 1 });
  o = r.data.order;
  assert.equal(o.total, 3 * 6000 + 2000);

  assert.equal((await kasir.put(`/api/orders/${o.id}`, { discount: 999999 })).status, 400);
  o = (await kasir.put(`/api/orders/${o.id}`, { discount: 1000 })).data.order;
  assert.equal(o.total, 19000);

  assert.equal((await kasir.post(`/api/orders/${o.id}/pay`, { payments: [{ method: 'tunai', amount: 18000, received: 20000 }] })).status, 400, 'must pay the exact total');
  assert.equal((await kasir.post(`/api/orders/${o.id}/pay`, { payments: [{ method: 'tunai', amount: 19000, received: 10000 }] })).status, 400, 'not enough cash');
  r = await kasir.post(`/api/orders/${o.id}/pay`, { payments: [{ method: 'tunai', amount: 19000, received: 50000 }] });
  assert.equal(r.data.order.status, 'paid');
  assert.equal(r.data.order.payments[0].change, 31000);
  assert.equal((await kasir.post(`/api/orders/${o.id}/items`, { items: [{ product_id: kopi.id, qty: 1 }] })).status, 400, 'paid bill is closed');
});

test('mixed payment QRIS + cash', async () => {
  const p = await product('Nasi Goreng');
  const o = (await kasir.post('/api/orders', { type: 'take_away', customer_name: 'Andi', items: [{ product_id: p.id, qty: 2 }] })).data.order;
  const r = await kasir.post(`/api/orders/${o.id}/pay`, { payments: [{ method: 'qris', amount: 20000 }, { method: 'tunai', amount: 10000, received: 10000 }] });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.order.payments.map((x) => x.method).sort(), ['qris', 'tunai']);
  const dup = (await kasir.post('/api/orders', { type: 'take_away', customer_name: 'B', items: [{ product_id: p.id, qty: 1 }] })).data.order;
  assert.equal((await kasir.post(`/api/orders/${dup.id}/pay`, { payments: [{ method: 'tunai', amount: 5000 }, { method: 'tunai', amount: 10000 }] })).status, 400);
});

test('take-away needs a table or a name; dine-in needs a table', async () => {
  const p = await product('Teh Manis');
  assert.equal((await kasir.post('/api/orders', { type: 'dine_in', items: [{ product_id: p.id, qty: 1 }] })).status, 400);
  assert.equal((await kasir.post('/api/orders', { type: 'dine_in', table_id: 999, items: [{ product_id: p.id, qty: 1 }] })).status, 400);
});

test('move, merge and split bills', async () => {
  const teh = await product('Teh Manis');
  const kopi = await product('Kopi Tubruk');
  const a = (await kasir.post('/api/orders', { type: 'dine_in', table_id: 3, items: [{ product_id: teh.id, qty: 2 }] })).data.order;
  const b = (await kasir.post('/api/orders', { type: 'dine_in', table_id: 4, items: [{ product_id: kopi.id, qty: 1 }] })).data.order;

  let r = await kasir.post(`/api/orders/${a.id}/move`, { table_id: 5 });
  assert.equal(r.data.order.table_id, 5);

  r = await kasir.post(`/api/orders/${b.id}/merge`, { into: a.id });
  assert.equal(r.data.order.total, 2 * 4000 + 5000);
  assert.equal((await kasir.get('/api/orders/' + b.id)).status, 404, 'merged bill is gone');

  const tehLine = r.data.order.items.find((i) => i.product_id === teh.id);
  r = await kasir.post(`/api/orders/${a.id}/split`, { items: [{ id: tehLine.id, qty: 1 }] });
  assert.equal(r.data.order.total, 4000);
  assert.equal(r.data.from.total, 4000 + 5000);
  assert.equal(r.data.order.table_id, 5);

  const all = r.data.from.items.map((i) => ({ id: i.id, qty: i.qty }));
  assert.equal((await kasir.post(`/api/orders/${a.id}/split`, { items: all })).status, 400, 'cannot move every item out');

  const tables = (await kasir.get('/api/tables')).data.tables;
  assert.equal(tables.find((t) => t.id === 5).orders.length, 2);
});

test('only the owner can void; stock comes back', async () => {
  const p = await product('Bakwan');
  await owner.put('/api/admin/products/' + p.id, { track_stock: true, min_stock: 2 });
  assert.equal((await owner.post('/api/stock/' + p.id, { mode: 'masuk', qty: 5 })).data.product.stock, 5);
  assert.equal((await kasir.post('/api/stock/' + p.id, { mode: 'opname', qty: 50 })).status, 403, 'cashier may only add stock');

  const o = (await kasir.post('/api/orders', { type: 'take_away', customer_name: 'C', items: [{ product_id: p.id, qty: 4 }] })).data.order;
  let prod = await product('Bakwan');
  assert.equal(prod.stock, 1);
  assert.equal(prod.low_stock, true);

  const tooMany = await kasir.post(`/api/orders/${o.id}/items`, { items: [{ product_id: p.id, qty: 2 }] });
  assert.equal(tooMany.status, 400);
  assert.match(tooMany.data.error, /tinggal 1/);

  await kasir.post(`/api/orders/${o.id}/pay`, { payments: [{ method: 'qris', amount: 8000 }] });
  assert.equal((await kasir.post(`/api/orders/${o.id}/void`, { reason: 'salah' })).status, 403);
  assert.equal((await owner.post(`/api/orders/${o.id}/void`, { reason: '' })).status, 400, 'reason is required');
  const r = await owner.post(`/api/orders/${o.id}/void`, { reason: 'Salah input' });
  assert.equal(r.data.order.status, 'void');
  prod = await product('Bakwan');
  assert.equal(prod.stock, 5);

  const audit = (await owner.get('/api/admin/audit')).data.entries;
  assert.ok(audit.some((e) => e.action === 'bon.batal' && e.detail.includes('Salah input')));
});

test('empty bills can be thrown away, bills with items cannot', async () => {
  const p = await product('Es Jeruk');
  const empty = (await kasir.post('/api/orders', { type: 'dine_in', table_id: 6 })).data.order;
  assert.equal((await kasir.del('/api/orders/' + empty.id)).status, 200);
  const full = (await kasir.post('/api/orders', { type: 'dine_in', table_id: 6, items: [{ product_id: p.id, qty: 1 }] })).data.order;
  assert.equal((await kasir.del('/api/orders/' + full.id)).status, 400);
});

test('customer orders from the table QR, cashier accepts into the bill', async () => {
  const qr = (await owner.get('/api/admin/table-qr')).data.tables;
  const token = qr[6].url.split('/m/')[1];
  assert.match(qr[6].svg, /^<svg/);

  const menu = await guest.get('/api/public/table/' + token);
  assert.equal(menu.status, 200);
  assert.equal(menu.data.table.name, 'Meja 7');
  assert.equal(menu.data.products[0].stock, undefined, 'stock numbers stay private');
  assert.equal((await guest.get('/api/public/table/salah-token')).status, 404);

  const kopi = menu.data.products.find((p) => p.name === 'Kopi Jahe');
  assert.equal((await guest.post(`/api/public/table/${token}/order`, { customer_name: '', items: [{ product_id: kopi.id, qty: 1 }] })).status, 400);
  let r = await guest.post(`/api/public/table/${token}/order`, { customer_name: 'Rina', note: 'cepat ya', items: [{ product_id: kopi.id, qty: 2, note: 'panas' }] });
  assert.equal(r.status, 200);
  const reqToken = r.data.token;

  assert.equal((await kasir.get('/api/incoming/count')).data.pending, 1);
  assert.equal((await guest.get('/api/public/request/' + reqToken)).data.request.status, 'pending');

  const inc = (await kasir.get('/api/incoming')).data.pending[0];
  assert.equal(inc.total, 14000);
  r = await kasir.post(`/api/incoming/${inc.id}/accept`, {});
  assert.equal(r.data.order.source, 'meja');
  assert.equal(r.data.order.table_id, 7);
  assert.equal(r.data.order.items[0].note, 'panas');
  assert.equal((await kasir.post(`/api/incoming/${inc.id}/accept`, {})).status, 400, 'cannot accept twice');
  assert.equal((await guest.get('/api/public/request/' + reqToken)).data.request.status, 'accepted');

  // Second order from the same table goes into the existing bill
  r = await guest.post(`/api/public/table/${token}/order`, { customer_name: 'Rina', items: [{ product_id: kopi.id, qty: 1 }] });
  const second = (await kasir.get('/api/incoming')).data.pending[0];
  const bill = (await kasir.get('/api/tables')).data.tables.find((t) => t.id === 7).orders[0];
  r = await kasir.post(`/api/incoming/${second.id}/accept`, { order_id: bill.id });
  assert.equal(r.data.order.id, bill.id);
  assert.equal(r.data.order.total, 21000);

  // Reject with a reason the customer can read
  r = await guest.post(`/api/public/table/${token}/order`, { customer_name: 'Rina', items: [{ product_id: kopi.id, qty: 1 }] });
  const third = (await kasir.get('/api/incoming')).data.pending[0];
  await kasir.post(`/api/incoming/${third.id}/reject`, { reason: 'Kopi jahe habis' });
  const st = (await guest.get('/api/public/request/' + r.data.token)).data.request;
  assert.equal(st.status, 'rejected');
  assert.equal(st.reject_reason, 'Kopi jahe habis');

  // Owner can switch QR ordering off; old QR stops working after reset
  await owner.put('/api/admin/settings', { table_ordering: '0' });
  assert.equal((await guest.post(`/api/public/table/${token}/order`, { customer_name: 'X', items: [{ product_id: kopi.id, qty: 1 }] })).status, 400);
  await owner.put('/api/admin/settings', { table_ordering: '1' });
  await owner.post(`/api/admin/tables/7/reset-qr`);
  assert.equal((await guest.get('/api/public/table/' + token)).status, 404);
});

test('items that are switched off or sold out cannot be ordered', async () => {
  const p = await product('Cokelat');
  await owner.put('/api/admin/products/' + p.id, { available: false });
  const r = await kasir.post('/api/orders', { type: 'take_away', customer_name: 'D', items: [{ product_id: p.id, qty: 1 }] });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /tidak tersedia/);
  await owner.put('/api/admin/products/' + p.id, { available: true });
});

test('cash drawer: open, expected cash, close with difference', async () => {
  assert.equal((await kasir.get('/api/shift')).data.shift, null);
  const opened = (await kasir.post('/api/shift/open', { opening_cash: 100000 })).data.shift;
  assert.equal((await kasir.post('/api/shift/open', { opening_cash: 1 })).status, 400);
  // Cash paid earlier today joins this shift
  assert.ok(opened.tunai > 0);
  const p = await product('Teh Tarik');
  const o = (await kasir.post('/api/orders', { type: 'take_away', customer_name: 'E', items: [{ product_id: p.id, qty: 1 }] })).data.order;
  await kasir.post(`/api/orders/${o.id}/pay`, { payments: [{ method: 'tunai', amount: 8000, received: 10000 }] });
  const cur = (await kasir.get('/api/shift')).data.shift;
  assert.equal(cur.expected, 100000 + opened.tunai + 8000);
  const closed = (await kasir.post('/api/shift/close', { counted_cash: cur.expected - 2000, note: 'kurang' })).data.shift;
  assert.equal(closed.counted_cash - closed.expected_cash, -2000);
  assert.equal((await kasir.get('/api/shift')).data.shift, null);
});

test('reports and CSV export', async () => {
  const r = (await owner.get('/api/admin/report')).data;
  assert.ok(r.count >= 3);
  assert.equal(r.total, r.methods.reduce((s, m) => s + m.amount, 0), 'payments add up to revenue');
  assert.ok(r.items.length && r.hours.length && r.shifts.length === 1);
  assert.equal(r.void_count, 1);

  const csv = await owner.get('/api/admin/report.csv');
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.match(csv.headers.get('content-disposition'), /transaksi_\d{4}-\d{2}-\d{2}\.csv/);
  assert.ok(csv.data.startsWith('No. bon;Waktu;Status'));
  const bytes = new Uint8Array(await (await fetch(srv.base + '/api/admin/report.csv', { headers: { cookie: owner.cookie() } })).arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], 'UTF-8 BOM so Excel shows the text right');
  const menuCsv = await owner.get('/api/admin/report.csv?kind=menu');
  assert.match(menuCsv.data, /Menu;Kategori;Terjual;Pendapatan/);
});

test('CSV cells cannot start a spreadsheet formula', async () => {
  const p = await product('Rempeyek Kacang');
  const o = (await kasir.post('/api/orders', { type: 'take_away', customer_name: '=HYPERLINK("x")', items: [{ product_id: p.id, qty: 1 }] })).data.order;
  await kasir.post(`/api/orders/${o.id}/pay`, { payments: [{ method: 'qris', amount: 5000 }] });
  const csv = (await owner.get('/api/admin/report.csv')).data;
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
});

test('settings: QRIS image is validated, table count changes', async () => {
  assert.equal((await owner.put('/api/admin/settings', { qris_image: 'data:text/html;base64,PHA+' })).status, 400);
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  assert.equal((await owner.put('/api/admin/settings', { qris_image: png, shop_name: 'Warkop Tes' })).status, 200);
  assert.equal((await kasir.get('/api/shop')).data.qris, true);
  assert.equal((await kasir.get('/api/shop/qris')).data.image, png);
  // Table 5 still has open bills, so it cannot be removed
  assert.equal((await owner.put('/api/admin/settings', { table_count: 3 })).status, 400);
  const r = await owner.put('/api/admin/settings', { table_count: 12 });
  assert.equal(r.data.tables.length, 12);
});

test('pages are served, unknown pages get the 404 page', async () => {
  for (const page of ['/login', '/kasir', '/meja', '/masuk', '/riwayat', '/stok', '/laporan', '/menu', '/staf', '/pengaturan', '/qr-meja', '/struk', '/m/abc']) {
    const r = await guest.get(page);
    assert.equal(r.status, 200, page);
  }
  assert.equal((await guest.get('/tidak-ada')).status, 404);
  assert.equal((await kasir.get('/api/tidak-ada')).status, 404);
});
