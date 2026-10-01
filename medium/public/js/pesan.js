/* Customer page opened from the QR on a table: browse the menu and send an order to the cashier. */
'use strict';
(function () {
  const { $, $$, esc, rupiah, api } = App;
  const token = location.pathname.split('/').pop();
  const KEY = 'wk-pesan-' + token;
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const main = $('#app');
  let info; let cart = []; let cat = 'all';
  let saved = store.get();
  let pollTimer;

  const qtyOf = (pid) => cart.filter((c) => c.product_id === pid).reduce((s, c) => s + c.qty, 0);
  const total = () => cart.reduce((s, c) => s + c.price * c.qty, 0);
  const count = () => cart.reduce((s, c) => s + c.qty, 0);
  const persist = () => { saved.cart = cart; store.set(saved); };

  function error(msg) {
    main.innerHTML = `<div class="c-empty"><div class="c-icon">!</div><h1>Ups</h1><p>${esc(msg)}</p></div>`;
  }

  async function start() {
    try { info = await api('/api/public/table/' + encodeURIComponent(token)); } catch (e) { return error(e.message); }
    document.title = `${info.table.name} — ${info.shop.name}`;
    cart = (saved.cart || []).filter((c) => info.products.some((p) => p.id === c.product_id && p.sellable));
    if (saved.request) return status(saved.request);
    menuView();
  }

  // ---------- menu ----------
  function menuView() {
    clearTimeout(pollTimer);
    const prods = info.products.filter((p) => cat === 'all' || String(p.category_id) === cat);
    const cats = info.categories.filter((c) => info.products.some((p) => p.category_id === c.id));
    main.innerHTML = `
      <header class="c-head">
        <div><b>${esc(info.shop.name)}</b><span>${esc(info.shop.tagline || '')}</span></div>
        <span class="c-table">${esc(info.table.name)}</span>
      </header>
      ${info.ordering ? '' : '<div class="c-alert">Pesan dari meja sedang ditutup. Lihat menu di bawah, lalu pesan ke kasir, ya.</div>'}
      <nav class="c-cats">${[['all', 'Semua'], ...cats.map((c) => [String(c.id), c.name])].map(([k, n]) => `<button class="${k === cat ? 'on' : ''}" data-cat="${k}">${esc(n)}</button>`).join('')}</nav>
      <ul class="c-list">
        ${prods.map((p) => {
          const n = qtyOf(p.id);
          return `<li class="c-item${p.sellable ? '' : ' off'}">
            <div class="c-info"><b>${esc(p.name)}${p.tag ? ` <span class="c-tag">${esc(p.tag)}</span>` : ''}</b>
              ${p.description ? `<span class="c-desc">${esc(p.description)}</span>` : ''}
              <span class="c-price">${rupiah(p.price)}${!p.sellable ? ' · <span class="c-out">Habis</span>' : p.left !== null ? ` · <span class="c-left">sisa ${p.left}</span>` : ''}</span></div>
            ${info.ordering && p.sellable ? (n ? `<div class="c-qty"><button data-d="-1" data-p="${p.id}" aria-label="Kurangi">−</button><span>${n}</span><button data-d="1" data-p="${p.id}" aria-label="Tambah">+</button></div>`
              : `<button class="c-add" data-d="1" data-p="${p.id}">Tambah</button>`) : ''}
          </li>`;
        }).join('')}
      </ul>
      ${info.ordering && count() ? `<button class="c-bar" data-cart><span>${count()} item</span><b>${rupiah(total())}</b><span>Lanjut ›</span></button>` : ''}`;
    $$('[data-cat]').forEach((b) => b.addEventListener('click', () => { cat = b.dataset.cat; menuView(); }));
    $$('[data-p]').forEach((b) => b.addEventListener('click', () => change(Number(b.dataset.p), Number(b.dataset.d))));
    const c = $('[data-cart]');
    if (c) c.addEventListener('click', cartView);
  }
  function change(pid, d) {
    const p = info.products.find((x) => x.id === pid);
    if (d > 0) {
      if (p.left !== null && qtyOf(pid) >= p.left) return;
      const line = cart.find((c) => c.product_id === pid && !c.note);
      if (line) line.qty += 1; else cart.push({ product_id: pid, name: p.name, price: p.price, qty: 1, note: '' });
    } else {
      const line = [...cart].reverse().find((c) => c.product_id === pid);
      if (line) { line.qty -= 1; if (!line.qty) cart.splice(cart.indexOf(line), 1); }
    }
    persist();
    const y = scrollY; menuView(); scrollTo(0, y);
  }

  // ---------- cart / checkout ----------
  function cartView() {
    main.innerHTML = `
      <header class="c-head"><button class="c-back" data-back aria-label="Kembali ke menu">‹</button><div><b>Pesanan kamu</b><span>${esc(info.table.name)}</span></div></header>
      <ul class="c-list">
        ${cart.map((c, i) => `<li class="c-item">
          <div class="c-info"><b>${esc(c.name)}</b><span class="c-price">${rupiah(c.price)}</span>
            <input class="c-note" data-note="${i}" value="${esc(c.note)}" maxlength="80" placeholder="Catatan (mis. tidak pedas)"></div>
          <div class="c-qty"><button data-i="${i}" data-d="-1" aria-label="Kurangi">−</button><span>${c.qty}</span><button data-i="${i}" data-d="1" aria-label="Tambah">+</button></div>
        </li>`).join('')}
      </ul>
      <section class="c-form">
        <label>Nama kamu<input data-name maxlength="40" value="${esc(saved.name || '')}" placeholder="Supaya kasir tahu pesanan siapa" autocomplete="given-name"></label>
        <label>Catatan untuk kasir (opsional)<input data-gnote maxlength="120" placeholder="mis. minta sendok tambah"></label>
        <div class="c-sum"><span>Total</span><b>${rupiah(total())}</b></div>
        <p class="c-hint">Bayar di kasir setelah selesai makan, ya. Harga bisa berubah kalau menu diubah kasir.</p>
        <p class="c-err" data-err hidden></p>
        <button class="c-send" data-send>Kirim pesanan ke kasir</button>
      </section>`;
    $('[data-back]').addEventListener('click', menuView);
    $$('[data-note]').forEach((inp) => inp.addEventListener('input', () => { cart[Number(inp.dataset.note)].note = inp.value; persist(); }));
    $$('[data-i]').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.i); const c = cart[i]; const p = info.products.find((x) => x.id === c.product_id);
      if (Number(b.dataset.d) > 0) { if (p && p.left !== null && qtyOf(c.product_id) >= p.left) return; c.qty += 1; } else { c.qty -= 1; if (!c.qty) cart.splice(i, 1); }
      persist();
      if (!cart.length) return menuView();
      cartView();
    }));
    $('[data-send]').addEventListener('click', send);
  }

  async function send() {
    const name = $('[data-name]').value.trim();
    const err = $('[data-err]');
    if (!name) { err.textContent = 'Tulis nama kamu dulu, ya.'; err.hidden = false; $('[data-name]').focus(); return; }
    const btn = $('[data-send]'); btn.disabled = true; btn.textContent = 'Mengirim…';
    try {
      const r = await api(`/api/public/table/${encodeURIComponent(token)}/order`, {
        method: 'POST',
        body: { customer_name: name, note: $('[data-gnote]').value, items: cart.map(({ product_id, qty, note }) => ({ product_id, qty, note })) },
      });
      cart = []; saved = { name, request: r.token }; store.set(saved);
      status(r.token);
    } catch (e) {
      err.textContent = e.message; err.hidden = false;
      btn.disabled = false; btn.textContent = 'Kirim pesanan ke kasir';
    }
  }

  // ---------- status ----------
  async function status(reqToken) {
    clearTimeout(pollTimer);
    let r;
    try { ({ request: r } = await api('/api/public/request/' + encodeURIComponent(reqToken))); } catch (e) {
      if (/tidak ditemukan/.test(e.message)) { saved.request = null; store.set(saved); return menuView(); }
      pollTimer = setTimeout(() => status(reqToken), 6000); // offline for a moment; try again
      return;
    }
    const STATE = {
      pending: ['c-wait', '…', 'Menunggu kasir', 'Pesananmu sudah terkirim. Kasir akan segera memeriksanya.'],
      accepted: ['c-ok', '✓', 'Pesanan diterima', 'Pesananmu sedang dibuat. Bayar di kasir setelah selesai, ya.'],
      rejected: ['c-bad', '✕', 'Pesanan ditolak', r.reject_reason],
    }[r.status];
    main.innerHTML = `
      <header class="c-head"><div><b>${esc(info.shop.name)}</b><span>${esc(r.table_name)}</span></div></header>
      <section class="c-status ${STATE[0]}">
        <div class="c-icon">${STATE[1]}</div>
        <h1>${STATE[2]}</h1>
        <p>${esc(STATE[3])}</p>
      </section>
      <section class="c-receipt">
        <b>${esc(r.customer_name)}</b>
        <ul>${r.items.map((i) => `<li><span>${i.qty}× ${esc(i.name)}${i.note ? `<em>${esc(i.note)}</em>` : ''}</span><span>${rupiah(i.price * i.qty)}</span></li>`).join('')}</ul>
        <div class="c-sum"><span>Total</span><b>${rupiah(r.total)}</b></div>
      </section>
      ${r.status === 'pending' ? '' : '<button class="c-send" data-again>Pesan lagi</button>'}`;
    const again = $('[data-again]');
    if (again) again.addEventListener('click', () => { saved.request = null; store.set(saved); menuView(); });
    if (r.status === 'pending') pollTimer = setTimeout(() => status(reqToken), 4000);
  }

  start();
})();
