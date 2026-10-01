'use strict';
(async () => {
  const { $, esc, api, fail } = App;
  await App.boot('pengaturan', { owner: true });
  const main = $('#main');
  try {
    const { tables, shop } = await api('/api/admin/table-qr');
    main.innerHTML = `
      <div class="page-head no-print"><div><h1>QR meja</h1><p>Cetak, gunting, lalu tempel di setiap meja. Pelanggan memindai untuk melihat menu dan memesan.</p></div>
        <div class="actions"><a class="btn ghost" href="/pengaturan">Kembali</a><button class="btn" data-print>Cetak</button></div></div>
      ${tables.length ? `<div class="qr-grid">${tables.map((t) => `
        <figure class="qr-card">
          <div class="qr-shop">${esc(shop)}</div>
          <div class="qr-code">${t.svg}</div>
          <figcaption><b>${esc(t.name)}</b><span>Pindai untuk lihat menu &amp; pesan</span></figcaption>
          <div class="qr-url no-print">${esc(t.url)}</div>
        </figure>`).join('')}</div>` : '<div class="card empty">Belum ada meja. Atur jumlah meja di Pengaturan.</div>'}`;
    const p = $('[data-print]');
    if (p) p.addEventListener('click', () => window.print());
  } catch (e) { fail(e); }
})();
