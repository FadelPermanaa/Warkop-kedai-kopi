'use strict';
(async () => {
  const { $, $$, esc, rupiah, api, fail, time } = App;
  await App.boot('meja');
  const main = $('#main');

  async function load() {
    const { tables, take_away: takeAway } = await api('/api/tables');
    const busy = tables.filter((t) => t.orders.length).length;
    const open = [...tables.flatMap((t) => t.orders), ...takeAway];
    main.innerHTML = `
      <div class="page-head"><div><h1>Meja &amp; bon</h1><p>${busy} dari ${tables.length} meja terisi · ${open.length} bon belum dibayar (${rupiah(open.reduce((s, o) => s + o.total, 0))})</p></div>
        <a class="btn" href="/kasir">+ Pesanan baru</a></div>
      <div class="table-grid">
        ${tables.map((t) => `
          <div class="tcard ${t.orders.length ? 'busy' : ''}">
            <div class="tcard-head"><b>${esc(t.name)}</b>${t.orders.length ? `<span class="chip amber">${t.orders.length > 1 ? t.orders.length + ' bon' : 'Terisi'}</span>` : '<span class="chip grey">Kosong</span>'}</div>
            ${t.orders.map((o) => `<button class="tbill" data-open="${o.id}"><span>${o.customer_name ? esc(o.customer_name) : esc(o.code)}<small>${o.item_count} item · sejak ${time(o.opened_at)}</small></span><b>${rupiah(o.total)}</b></button>`).join('')}
            ${t.orders.length ? '' : `<a class="tnew" href="/kasir?table=${t.id}">+ Buka bon</a>`}
          </div>`).join('')}
      </div>
      <h2 style="margin:26px 0 12px">Bawa pulang</h2>
      ${takeAway.length ? `<div class="table-grid">${takeAway.map((o) => `
        <div class="tcard busy"><button class="tbill" data-open="${o.id}"><span>${esc(o.customer_name || o.code)}<small>${o.item_count} item · sejak ${time(o.opened_at)}</small></span><b>${rupiah(o.total)}</b></button></div>`).join('')}</div>`
        : '<div class="card empty">Tidak ada pesanan bawa pulang yang belum dibayar.</div>'}`;
    $$('[data-open]').forEach((b) => b.addEventListener('click', () => App.bon.show(Number(b.dataset.open), { onChange: () => load().catch(fail) })));
  }
  await load().catch(fail);
  // Refresh when a table order is accepted elsewhere.
  document.addEventListener('incoming', () => { if (!document.querySelector('.modal-back')) load().catch(() => {}); });
})();
