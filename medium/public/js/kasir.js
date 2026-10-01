'use strict';
(async () => {
  const { $, $$, esc, rupiah, num, api, toast, fail, modal, confirmBox } = App;
  await App.boot('kasir');
  const main = $('#main');
  main.classList.add('pos-page');
  const params = new URLSearchParams(location.search);

  let cats = []; let products = []; let tables = [];
  let catFilter = 'all'; let search = '';
  let order = null;                       // existing open bill (from the server)
  let cart = [];                          // items not yet saved: {product_id, name, price, qty, note}
  let draft = { type: 'dine_in', table_id: Number(params.get('table')) || null, customer_name: '' };
  let busy = false;

  main.innerHTML = `
    <section class="pos-menu">
      <div class="pos-tools">
        <input type="search" placeholder="Cari menu…" data-search aria-label="Cari menu">
        <div class="cats" data-cats></div>
      </div>
      <div class="tiles" data-tiles></div>
    </section>
    <aside class="pos-bill" data-bill></aside>
    <button class="bill-fab" data-fab hidden></button>`;

  async function loadMenu() { ({ categories: cats, products } = await api('/api/menu')); renderCats(); renderTiles(); }
  async function loadTables() { ({ tables } = await api('/api/tables')); }
  async function loadOrder(id) {
    const r = await api('/api/orders/' + id);
    if (r.order.status !== 'open') { toast(r.order.status === 'paid' ? 'Bon ini sudah dibayar' : 'Bon ini sudah dibatalkan', true); order = null; return; }
    order = r.order;
  }

  // ---------- menu ----------
  function renderCats() {
    $('[data-cats]').innerHTML = [['all', 'Semua'], ...cats.map((c) => [String(c.id), c.name])]
      .map(([k, n]) => `<button class="${k === catFilter ? 'on' : ''}" data-cat="${k}">${esc(n)}</button>`).join('');
    $$('[data-cat]').forEach((b) => b.addEventListener('click', () => { catFilter = b.dataset.cat; renderCats(); renderTiles(); }));
  }
  function inCart(pid) { return cart.filter((c) => c.product_id === pid).reduce((s, c) => s + c.qty, 0); }
  function renderTiles() {
    const q = search.toLowerCase();
    const list = products.filter((p) => (catFilter === 'all' || String(p.category_id) === catFilter) && (!q || p.name.toLowerCase().includes(q)));
    $('[data-tiles]').innerHTML = list.map((p) => {
      const left = p.track_stock ? p.stock - inCart(p.id) : null;
      const off = !p.available || (p.track_stock && left <= 0);
      const n = inCart(p.id);
      return `<button class="tile${off ? ' off' : ''}${n ? ' picked' : ''}" data-add="${p.id}" ${off ? 'disabled' : ''}>
        ${n ? `<span class="tile-n">${n}</span>` : ''}
        <b>${esc(p.name)}</b>
        <span class="tile-price">${rupiah(p.price)}</span>
        ${!p.available ? '<span class="chip grey">Tidak tersedia</span>' : p.track_stock ? (left <= 0 ? '<span class="chip bad">Habis</span>' : `<span class="chip ${p.low_stock || left <= p.min_stock ? 'amber' : 'grey'}">Sisa ${left}</span>`) : ''}
      </button>`;
    }).join('') || '<div class="empty">Menu tidak ditemukan.</div>';
    $$('[data-add]').forEach((b) => b.addEventListener('click', () => addToCart(Number(b.dataset.add))));
  }
  function addToCart(pid) {
    const p = products.find((x) => x.id === pid);
    if (!p) return;
    const line = cart.find((c) => c.product_id === pid && !c.note);
    if (line) line.qty += 1; else cart.push({ product_id: p.id, name: p.name, price: p.price, qty: 1, note: '' });
    renderTiles(); renderBill();
  }

  // ---------- bill ----------
  const cartTotal = () => cart.reduce((s, c) => s + c.price * c.qty, 0);
  function tableOptions() {
    return tables.map((t) => `<option value="${t.id}" ${t.id === draft.table_id ? 'selected' : ''}>${esc(t.name)}${t.orders.length ? ' · ada bon' : ''}</option>`).join('');
  }
  function renderBill() {
    const bill = $('[data-bill]');
    const sub = (order ? order.subtotal : 0) + cartTotal();
    const discount = order ? order.discount : 0;
    const total = sub - discount;
    const count = (order ? order.items.reduce((s, i) => s + i.qty, 0) : 0) + cart.reduce((s, c) => s + c.qty, 0);

    const head = order ? `
      <div class="bill-head">
        <div><span class="muted small">Bon ${esc(order.code)}</span><h2>${esc(order.label)}</h2></div>
        <button class="btn ghost sm" data-new>Bon baru</button>
      </div>` : `
      <div class="bill-head"><h2>Pesanan baru</h2>${cart.length ? '<button class="link" data-clear>Kosongkan</button>' : ''}</div>
      <div class="seg block" role="tablist">
        <button class="${draft.type === 'dine_in' ? 'on' : ''}" data-type="dine_in">Makan di sini</button>
        <button class="${draft.type === 'take_away' ? 'on' : ''}" data-type="take_away">Bawa pulang</button>
      </div>
      <div class="form-row tight">
        ${draft.type === 'dine_in' ? `<label class="field"><span>Meja</span><select data-table><option value="">Pilih meja…</option>${tableOptions()}</select></label>` : ''}
        <label class="field"><span>Nama pelanggan${draft.type === 'dine_in' ? ' (opsional)' : ''}</span><input data-name value="${esc(draft.customer_name)}" maxlength="40" placeholder="mis. Budi"></label>
      </div>`;

    const saved = order ? order.items.map((it) => `
      <li class="line">
        <div class="line-main"><b>${esc(it.name)}</b>${it.note ? `<span class="note">${esc(it.note)}</span>` : ''}<span class="muted small">${rupiah(it.price)}</span></div>
        <div class="qty"><button aria-label="Kurangi" data-sq="${it.id}" data-d="-1">−</button><span>${it.qty}</span><button aria-label="Tambah" data-sq="${it.id}" data-d="1">+</button></div>
        <div class="line-sum">${rupiah(it.price * it.qty)}</div>
      </li>`).join('') : '';
    const fresh = cart.map((c, i) => `
      <li class="line new">
        <div class="line-main"><b>${esc(c.name)}</b>${c.note ? `<span class="note">${esc(c.note)}</span>` : ''}<button class="link" data-note="${i}">${c.note ? 'Ubah catatan' : '+ Catatan'}</button></div>
        <div class="qty"><button aria-label="Kurangi" data-cq="${i}" data-d="-1">−</button><span>${c.qty}</span><button aria-label="Tambah" data-cq="${i}" data-d="1">+</button></div>
        <div class="line-sum">${rupiah(c.price * c.qty)}</div>
      </li>`).join('');

    bill.innerHTML = `
      ${head}
      <ul class="lines">
        ${saved}
        ${order && cart.length ? '<li class="lines-sep">Tambahan baru (belum disimpan)</li>' : ''}
        ${fresh}
        ${!saved && !fresh ? '<li class="empty">Ketuk menu untuk menambah pesanan.</li>' : ''}
      </ul>
      <div class="sums">
        <div><span>Subtotal</span><span class="num">${rupiah(sub)}</span></div>
        ${order ? `<div><span>Diskon <button class="link" data-discount>${discount ? 'ubah' : 'tambah'}</button></span><span class="num">${discount ? '−' + rupiah(discount) : '—'}</span></div>` : ''}
        <div class="grand"><span>Total</span><span class="num">${rupiah(total)}</span></div>
      </div>
      <div class="bill-actions">
        <button class="btn ghost" data-save ${!cart.length || busy ? 'disabled' : ''}>${order ? 'Simpan tambahan' : 'Simpan bon'}</button>
        <button class="btn amber lg" data-pay ${!count || busy ? 'disabled' : ''}>Bayar ${rupiah(total)}</button>
      </div>
      ${order && !order.items.length && !cart.length ? '<button class="link danger-link" data-discard>Hapus bon kosong ini</button>' : ''}`;

    const fab = $('[data-fab]');
    fab.hidden = !count && !order;
    fab.innerHTML = `<span>${count} item</span><b>${rupiah(total)}</b><span>Lihat bon ›</span>`;

    // events
    const on = (sel, fn) => { const el = bill.querySelector(sel); if (el) el.addEventListener('click', fn); };
    on('[data-new]', () => newOrder());
    on('[data-clear]', () => { cart = []; renderTiles(); renderBill(); });
    $$('[data-type]', bill).forEach((b) => b.addEventListener('click', () => { draft.type = b.dataset.type; renderBill(); }));
    const sel = bill.querySelector('[data-table]');
    if (sel) sel.addEventListener('change', () => pickTable(Number(sel.value) || null));
    const nm = bill.querySelector('[data-name]');
    if (nm) nm.addEventListener('input', () => { draft.customer_name = nm.value; });
    $$('[data-cq]', bill).forEach((b) => b.addEventListener('click', () => {
      const c = cart[Number(b.dataset.cq)];
      c.qty += Number(b.dataset.d);
      if (c.qty <= 0) cart.splice(Number(b.dataset.cq), 1);
      else if (b.dataset.d === '1') {
        const p = products.find((x) => x.id === c.product_id);
        if (p && p.track_stock && inCart(p.id) > p.stock) { c.qty -= 1; toast(`Stok ${p.name} tinggal ${p.stock}`, true); }
      }
      renderTiles(); renderBill();
    }));
    $$('[data-note]', bill).forEach((b) => b.addEventListener('click', () => editNote(Number(b.dataset.note))));
    $$('[data-sq]', bill).forEach((b) => b.addEventListener('click', () => changeSaved(Number(b.dataset.sq), Number(b.dataset.d))));
    on('[data-discount]', editDiscount);
    on('[data-save]', () => save().then((ok) => ok && toast('Bon tersimpan')).catch(fail));
    on('[data-pay]', () => startPay());
    on('[data-discard]', discard);
  }

  async function pickTable(tid) {
    draft.table_id = tid;
    const t = tables.find((x) => x.id === tid);
    if (t && t.orders.length) {
      const target = t.orders[0];
      const ok = await confirmBox(`${t.name} sudah punya bon (${rupiah(target.total)}). Tambahkan pesanan ke bon itu?`, { ok: 'Ya, tambahkan' });
      if (ok) { await loadOrder(target.id); history.replaceState(null, '', '/kasir?order=' + target.id); }
    }
    renderBill();
  }
  function editNote(i) {
    const c = cart[i];
    const m = modal(`<h2>Catatan ${esc(c.name)}</h2>
      <label class="field"><span>Contoh: tidak pedas, es sedikit, gula dipisah</span><input data-v value="${esc(c.note)}" maxlength="80"></label>
      <div class="chips-pick">${['Tidak pedas', 'Pedas', 'Es sedikit', 'Tanpa es', 'Gula sedikit', 'Panas'].map((s) => `<button class="chip" data-s="${s}">${s}</button>`).join('')}</div>
      <div class="foot"><button class="btn ghost" data-close>Batal</button><button class="btn" data-ok>Simpan</button></div>`);
    const inp = m.querySelector('[data-v]');
    $$('[data-s]', m).forEach((b) => b.addEventListener('click', () => { inp.value = inp.value ? `${inp.value}, ${b.dataset.s.toLowerCase()}` : b.dataset.s; inp.focus(); }));
    const ok = () => {
      const note = inp.value.trim();
      // A line with a note is kept separate from the same item without a note.
      if (c.qty > 1 && note && !c.note) { c.qty -= 1; cart.splice(i + 1, 0, { ...c, qty: 1, note }); } else c.note = note;
      m.close(); renderBill();
    };
    m.querySelector('[data-ok]').addEventListener('click', ok);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
  }
  async function changeSaved(itemId, d) {
    const it = order.items.find((x) => x.id === itemId);
    if (!it) return;
    const qty = it.qty + d;
    if (qty === 0 && !(await confirmBox(`Hapus ${it.name} dari bon?`, { ok: 'Hapus', danger: true }))) return;
    try { ({ order } = await api(`/api/orders/${order.id}/items/${itemId}`, { method: 'PUT', body: { qty } })); await loadMenu(); renderBill(); } catch (e) { fail(e); }
  }
  function editDiscount() {
    const m = modal(`<h2>Diskon</h2>
      <label class="field"><span>Potongan (Rupiah)</span><input data-v inputmode="numeric" value="${order.discount || ''}" placeholder="0"></label>
      <p class="muted small">Subtotal ${rupiah(order.subtotal)}. Diskon tercatat di riwayat aktivitas.</p>
      <div class="foot"><button class="btn ghost" data-close>Batal</button><button class="btn" data-ok>Simpan</button></div>`);
    m.querySelector('[data-ok]').addEventListener('click', async () => {
      try { ({ order } = await api('/api/orders/' + order.id, { method: 'PUT', body: { discount: num(m.querySelector('[data-v]').value) } })); m.close(); renderBill(); } catch (e) { fail(e); }
    });
  }
  async function discard() {
    try { await api('/api/orders/' + order.id, { method: 'DELETE' }); toast('Bon dihapus'); newOrder(); } catch (e) { fail(e); }
  }

  /** Save the pending items (creating the bill if needed). Returns true when something was saved. */
  async function save() {
    if (!cart.length && order) return true;
    if (!order && draft.type === 'dine_in' && !draft.table_id) { toast('Pilih meja dulu', true); const s = $('[data-table]'); if (s) s.focus(); return false; }
    if (!order && draft.type === 'take_away' && !draft.customer_name.trim()) { toast('Isi nama pelanggan untuk bawa pulang', true); const n = $('[data-name]'); if (n) n.focus(); return false; }
    busy = true; renderBill();
    try {
      const items = cart.map(({ product_id, qty, note }) => ({ product_id, qty, note }));
      if (order) ({ order } = await api(`/api/orders/${order.id}/items`, { method: 'POST', body: { items } }));
      else ({ order } = await api('/api/orders', { method: 'POST', body: { ...draft, items } }));
      cart = [];
      history.replaceState(null, '', '/kasir?order=' + order.id);
      await Promise.all([loadMenu(), loadTables()]);
      return true;
    } finally { busy = false; renderBill(); }
  }

  function newOrder() {
    order = null; cart = []; draft = { type: 'dine_in', table_id: null, customer_name: '' };
    history.replaceState(null, '', '/kasir');
    loadTables().then(renderBill).catch(fail);
    renderTiles(); renderBill();
  }

  // ---------- payment ----------
  async function startPay() {
    try { if (!(await save())) return; } catch (e) { return fail(e); }
    if (!order || !order.items.length) return;
    payModal(order);
  }

  function payModal(o) {
    const total = o.total;
    let method = 'tunai';
    const quick = [...new Set([total, ...[5000, 10000, 20000, 50000, 100000].map((n) => Math.ceil(total / n) * n)])].filter((n) => n >= total).sort((a, b) => a - b).slice(0, 5);
    const m = modal(`
      <h2>Bayar ${esc(o.label)}</h2>
      <div class="pay-total"><span>Total tagihan</span><b>${rupiah(total)}</b></div>
      <div class="seg block" data-methods>
        <button class="on" data-m="tunai">Tunai</button><button data-m="qris">QRIS</button><button data-m="campur">Campur</button>
      </div>
      <div data-body></div>
      <div class="foot"><button class="btn ghost" data-close>Batal</button><button class="btn ok lg" data-confirm>Selesaikan</button></div>`, { wide: true });
    const body = m.querySelector('[data-body]');
    const qrisImg = () => (App.shopQris ? `<div class="qris-show"><img src="${esc(App.shopQris)}" alt="QRIS"><span>${esc(App.shopQrisName || 'Minta pelanggan memindai QRIS ini')}</span></div>` : '<div class="alert">Gambar QRIS belum diunggah. Pemilik bisa mengunggahnya di Pengaturan.</div>');

    function draw() {
      $$('[data-m]', m).forEach((b) => b.classList.toggle('on', b.dataset.m === method));
      if (method === 'tunai') {
        body.innerHTML = `
          <label class="field"><span>Uang diterima</span><input class="big-input" data-recv inputmode="numeric" placeholder="${total.toLocaleString('id-ID')}"></label>
          <div class="quick">${quick.map((n) => `<button class="btn ghost" data-q="${n}">${n === total ? 'Uang pas' : rupiah(n)}</button>`).join('')}</div>
          <div class="change" data-change></div>`;
      } else if (method === 'qris') {
        body.innerHTML = `${qrisImg()}<p class="muted small center">Klik <b>Selesaikan</b> setelah pembayaran QRIS masuk di HP/aplikasi bank warung.</p>`;
      } else {
        body.innerHTML = `
          <div class="form-row">
            <label class="field"><span>Bayar lewat QRIS</span><input data-qamt inputmode="numeric" placeholder="0"></label>
            <label class="field"><span>Sisa dibayar tunai</span><input data-rest disabled></label>
          </div>
          <label class="field" style="margin-top:10px"><span>Uang tunai diterima</span><input class="big-input" data-recv inputmode="numeric" placeholder="sama dengan sisa"></label>
          <div class="change" data-change></div>
          <details class="qris-details"><summary>Tampilkan QRIS</summary>${qrisImg()}</details>`;
      }
      const recv = body.querySelector('[data-recv]');
      const qamt = body.querySelector('[data-qamt]');
      const upd = () => {
        const cashDue = method === 'campur' ? Math.max(0, total - num(qamt.value)) : total;
        if (qamt) body.querySelector('[data-rest]').value = rupiah(cashDue);
        if (!recv) return;
        const got = recv.value ? num(recv.value) : cashDue;
        const out = body.querySelector('[data-change]');
        out.innerHTML = got >= cashDue ? `<span>Kembalian</span><b>${rupiah(got - cashDue)}</b>` : `<span class="bad">Kurang</span><b class="bad">${rupiah(cashDue - got)}</b>`;
      };
      if (recv) { recv.addEventListener('input', () => { recv.value = recv.value ? num(recv.value).toLocaleString('id-ID') : ''; upd(); }); setTimeout(() => recv.focus(), 30); }
      if (qamt) qamt.addEventListener('input', () => { qamt.value = qamt.value ? num(qamt.value).toLocaleString('id-ID') : ''; upd(); });
      $$('[data-q]', body).forEach((b) => b.addEventListener('click', () => { recv.value = Number(b.dataset.q).toLocaleString('id-ID'); upd(); }));
      upd();
      if (recv) recv.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirm(); });
    }
    $$('[data-m]', m).forEach((b) => b.addEventListener('click', () => { method = b.dataset.m; draw(); }));

    async function confirm() {
      let payments;
      const recv = body.querySelector('[data-recv]');
      if (method === 'tunai') payments = [{ method: 'tunai', amount: total, received: recv.value ? num(recv.value) : total }];
      else if (method === 'qris') payments = [{ method: 'qris', amount: total }];
      else {
        const q = num(body.querySelector('[data-qamt]').value);
        if (q <= 0 || q >= total) return toast('Isi bagian QRIS (lebih dari 0 dan kurang dari total)', true);
        payments = [{ method: 'qris', amount: q }, { method: 'tunai', amount: total - q, received: recv.value ? num(recv.value) : total - q }];
      }
      const btn = m.querySelector('[data-confirm]');
      btn.disabled = true;
      try {
        const { order: paid } = await api(`/api/orders/${o.id}/pay`, { method: 'POST', body: { payments } });
        m.remove();
        done(paid);
      } catch (e) { fail(e); btn.disabled = false; }
    }
    m.querySelector('[data-confirm]').addEventListener('click', confirm);
    draw();
  }

  function done(paid) {
    const change = paid.payments.reduce((s, p) => s + p.change, 0);
    const m = modal(`
      <div class="done">
        <div class="done-icon">✓</div>
        <h2>Lunas</h2>
        <p class="muted">${esc(paid.label)} · ${esc(paid.code)} · ${rupiah(paid.total)}</p>
        ${paid.payments.some((p) => p.method === 'tunai') ? `<div class="change big"><span>Kembalian</span><b>${rupiah(change)}</b></div>` : ''}
      </div>
      <div class="foot center"><button class="btn ghost" data-print>Cetak struk</button><button class="btn" data-close>Pesanan baru</button></div>`, { onClose: newOrder });
    m.querySelector('[data-print]').addEventListener('click', () => window.open('/struk?id=' + paid.id + '&print=1', 'struk', 'width=420,height=700'));
  }

  // ---------- mobile bill sheet ----------
  $('[data-fab]').addEventListener('click', () => { document.body.classList.add('bill-open'); });
  $('[data-bill]').addEventListener('click', (e) => { if (e.target.closest('.bill-close')) document.body.classList.remove('bill-open'); });
  const closeBtn = document.createElement('button');
  closeBtn.className = 'bill-close btn ghost sm'; closeBtn.textContent = 'Tutup';
  $('[data-search]').addEventListener('input', (e) => { search = e.target.value.trim(); renderTiles(); });

  // ---------- start ----------
  try {
    const shop = await api('/api/shop');
    App.shopQrisName = shop.qris_name;
    if (shop.qris) App.shopQris = (await api('/api/shop/qris')).image;
    await Promise.all([loadMenu(), loadTables()]);
    if (params.get('order')) await loadOrder(Number(params.get('order')));
    renderBill();
    $('[data-bill]').prepend(closeBtn);
    if (order && params.get('pay') === '1') startPay();
  } catch (e) { fail(e); }

  // Keep the close button after every re-render (mobile only, hidden by CSS on desktop).
  new MutationObserver(() => { if (!$('.bill-close')) $('[data-bill]').prepend(closeBtn); }).observe($('[data-bill]'), { childList: true });
})();
