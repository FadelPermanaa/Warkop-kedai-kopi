/* Shared helpers for every staff page: API calls, top bar, watermark, toasts. */
'use strict';
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rupiah = (n) => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
  const num = (v) => Number(String(v ?? '').replace(/[^\d-]/g, '')) || 0;

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    let data = {};
    try { data = await res.json(); } catch { /* empty body */ }
    if (res.status === 401 && !path.startsWith('/api/public') && location.pathname !== '/login') {
      location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search);
      throw new Error('Silakan masuk dulu.');
    }
    if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan. Coba lagi.');
    return data;
  }

  let toastTimer;
  function toast(text, bad = false) {
    let el = $('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = text;
    el.classList.toggle('bad', !!bad);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }
  const fail = (err) => toast(err.message || String(err), true);

  /** Small modal. `html` is trusted markup built by the caller; returns the modal element. */
  function modal(html, { wide = false, onClose } = {}) {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    const first = back.querySelector('input, select, textarea, button:not([data-close])');
    if (first) setTimeout(() => first.focus(), 30);
    back.close = close;
    return back;
  }
  function confirmBox(message, { ok = 'Ya', danger = false } = {}) {
    return new Promise((resolve) => {
      const m = modal(`<h2>Konfirmasi</h2><p>${esc(message)}</p><div class="foot"><button class="btn ghost" data-close>Batal</button><button class="btn ${danger ? 'danger' : ''}" data-ok>${esc(ok)}</button></div>`, { onClose: () => resolve(false) });
      m.querySelector('[data-ok]').addEventListener('click', () => { resolve(true); m.remove(); });
    });
  }

  // Short "ding" for new table orders (no audio file needed).
  let audioCtx;
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      [880, 1320].forEach((f, i) => {
        const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
        o.frequency.value = f; o.type = 'sine';
        g.gain.setValueAtTime(0.0001, audioCtx.currentTime + i * 0.14);
        g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + i * 0.14 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + i * 0.14 + 0.35);
        o.connect(g).connect(audioCtx.destination); o.start(audioCtx.currentTime + i * 0.14); o.stop(audioCtx.currentTime + i * 0.14 + 0.4);
      });
    } catch { /* sound is optional */ }
  }

  const ICON = {
    cup: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-4Z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3"/></svg>',
  };

  const NAV = [
    ['kasir', '/kasir', 'Kasir'],
    ['meja', '/meja', 'Meja & bon'],
    ['masuk', '/masuk', 'Pesanan masuk', 'kasir'],
    ['riwayat', '/riwayat', 'Riwayat'],
    ['stok', '/stok', 'Stok'],
    ['laporan', '/laporan', 'Laporan', 'pemilik'],
    ['menu', '/menu', 'Menu', 'pemilik'],
    ['staf', '/staf', 'Staf', 'pemilik'],
    ['pengaturan', '/pengaturan', 'Pengaturan', 'pemilik'],
  ];

  function watermark() {
    if ($('.watermark')) return;
    const a = document.createElement('div');
    a.className = 'watermark';
    a.title = 'Dibuat oleh Linea.js';
    a.innerHTML = '<img src="/img/linea-mark.png" alt=""><span>dibuat oleh <b>Linea.js</b></span>';
    document.body.appendChild(a);
  }

  /** Every staff page calls this first. Redirects to login, checks the role, draws the top bar. */
  async function boot(page, { owner = false } = {}) {
    watermark();
    const { user, shop } = await api('/api/me');
    if (!user) { location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search); return new Promise(() => {}); }
    if (owner && user.role !== 'pemilik') { location.href = '/kasir'; return new Promise(() => {}); }
    const top = document.createElement('header');
    top.className = 'top no-print';
    top.innerHTML = `
      <a class="brand" href="/kasir"><span class="mark">${ICON.cup}</span><span>${esc(shop.name)}<small>Kasir Warkop</small></span></a>
      <nav class="nav" aria-label="Menu utama">${NAV.filter(([, , , role]) => !role || role === 'kasir' || user.role === role)
        .map(([key, href, label]) => `<a href="${href}" class="${key === page ? 'on' : ''}" data-nav="${key}">${label}${key === 'masuk' ? ' <span class="badge" data-incoming hidden>0</span>' : ''}</a>`).join('')}</nav>
      <div class="me"><span class="who"><b>${esc(user.name)}</b>${user.role === 'pemilik' ? 'Pemilik' : 'Kasir'}</span><button class="btn ghost sm" data-logout>Keluar</button></div>`;
    document.body.prepend(top);
    top.querySelector('[data-logout]').addEventListener('click', async () => { await api('/api/logout', { method: 'POST', body: {} }); location.href = '/login'; });
    App.user = user;
    App.shop = shop;
    pollIncoming();
    return user;
  }

  // Badge for new table orders on every page (polls every 8 s).
  let lastIncoming = null;
  async function pollIncoming() {
    try {
      const { pending } = await api('/api/incoming/count');
      $$('[data-incoming]').forEach((b) => { b.textContent = pending; b.hidden = !pending; });
      if (lastIncoming !== null && pending > lastIncoming) { beep(); toast('Ada pesanan baru dari meja'); }
      lastIncoming = pending;
      document.dispatchEvent(new CustomEvent('incoming', { detail: pending }));
    } catch { /* offline for a moment */ }
    setTimeout(pollIncoming, 8000);
  }

  const time = (ts) => (ts ? String(ts).slice(11, 16) : '');
  const dateLong = (d) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  window.App = { $, $$, esc, rupiah, num, api, toast, fail, modal, confirmBox, beep, boot, watermark, time, dateLong, ICON };
})();
