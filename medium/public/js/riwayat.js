'use strict';
(async () => {
  const { $, $$, esc, rupiah, api, fail, time, dateLong } = App;
  await App.boot('riwayat');
  const main = $('#main');
  const params = new URLSearchParams(location.search);
  const todayStr = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  let state = { date: params.get('date') || todayStr(), status: '', q: '' };

  main.innerHTML = `
    <div class="page-head"><div><h1>Riwayat transaksi</h1><p data-sub></p></div></div>
    <div class="card">
      <div class="filters">
        <input type="date" data-date value="${state.date}" max="${todayStr()}" aria-label="Tanggal">
        <div class="seg" data-status><button class="on" data-s="">Semua</button><button data-s="paid">Lunas</button><button data-s="void">Dibatalkan</button></div>
        <input type="search" data-q placeholder="Cari no. bon, nama, meja, menu…" aria-label="Cari">
      </div>
      <div class="grid grid-3" data-stats style="margin:14px 0"></div>
      <div class="table-wrap"><table class="data stack">
        <thead><tr><th>Jam</th><th>Bon</th><th>Pesanan</th><th>Bayar</th><th class="num">Total</th><th>Status</th></tr></thead>
        <tbody data-rows></tbody>
      </table></div>
    </div>`;

  async function load() {
    const r = await api(`/api/orders?date=${state.date}&status=${state.status}&q=${encodeURIComponent(state.q)}`);
    $('[data-sub]').textContent = dateLong(r.date);
    $('[data-stats]').innerHTML = `
      <div class="stat blue"><span>Pendapatan</span><b>${rupiah(r.summary.total)}</b></div>
      <div class="stat"><span>Transaksi lunas</span><b>${r.summary.count}</b></div>
      <div class="stat"><span>Dibatalkan</span><b>${r.summary.void}</b></div>`;
    $('[data-rows]').innerHTML = r.orders.map((o) => `
      <tr class="clickable" data-open="${o.id}">
        <td data-label="Jam">${time(o.paid_at || o.voided_at)}</td>
        <td data-label="Bon">${esc(o.code)}</td>
        <td data-label="Pesanan">${esc(o.label)}</td>
        <td data-label="Bayar">${o.methods.split(',').filter(Boolean).map((m) => App.bon.METHOD[m]).join(' + ') || '—'}</td>
        <td data-label="Total" class="num">${o.status === 'void' ? `<s class="muted">${rupiah(o.total)}</s>` : rupiah(o.total)}</td>
        <td data-label="Status">${App.bon.STATUS[o.status]}</td>
      </tr>`).join('') || '<tr><td colspan="6" class="empty">Belum ada transaksi di tanggal ini.</td></tr>';
    $$('[data-open]').forEach((tr) => tr.addEventListener('click', () => App.bon.show(Number(tr.dataset.open), { onChange: () => load().catch(fail) })));
  }

  $('[data-date]').addEventListener('change', (e) => { state.date = e.target.value || todayStr(); load().catch(fail); });
  $$('[data-s]').forEach((b) => b.addEventListener('click', () => {
    state.status = b.dataset.s;
    $$('[data-s]').forEach((x) => x.classList.toggle('on', x === b));
    load().catch(fail);
  }));
  let t;
  $('[data-q]').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value.trim(); load().catch(fail); }, 250); });
  load().catch(fail);
})();
