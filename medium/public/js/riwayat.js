'use strict';
(async () => {
  const { $, $$, esc, rupiah, num, api, toast, fail, modal, time, dateLong } = App;
  await App.boot('riwayat');
  const main = $('#main');
  const params = new URLSearchParams(location.search);
  const todayStr = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  let state = { date: params.get('date') || todayStr(), status: '', q: '' };

  main.innerHTML = `
    <div class="page-head"><div><h1>Riwayat transaksi</h1><p data-sub></p></div></div>
    <div class="card kas" id="kas" data-kas></div>
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

  // ---------- cash drawer ----------
  async function loadKas() {
    const { shift } = await api('/api/shift');
    const box = $('[data-kas]');
    if (!shift) {
      box.innerHTML = `<div class="kas-row"><div><h2>Kas belum dibuka</h2><p class="muted small">Buka kas di awal shift dengan mengisi modal (uang kembalian) di laci. Saat tutup, sistem menghitung berapa uang yang seharusnya ada.</p></div>
        <button class="btn" data-kas-open>Buka kas</button></div>`;
      $('[data-kas-open]').addEventListener('click', openKas);
      return;
    }
    box.innerHTML = `<div class="kas-row"><div><h2>Kas dibuka ${time(shift.opened_at)}${shift.opened_by_name ? ' · ' + esc(shift.opened_by_name) : ''}</h2>
        <p class="muted small">${shift.orders} transaksi lunas di shift ini</p></div><button class="btn amber" data-kas-close>Tutup kas</button></div>
      <div class="kas-nums"><div><span>Modal awal</span><b>${rupiah(shift.opening_cash)}</b></div><div><span>Tunai masuk</span><b>${rupiah(shift.tunai)}</b></div>
        <div><span>QRIS masuk</span><b>${rupiah(shift.qris)}</b></div><div class="hl"><span>Seharusnya di laci</span><b>${rupiah(shift.expected)}</b></div></div>`;
    $('[data-kas-close]').addEventListener('click', () => closeKas(shift));
  }
  function openKas() {
    const m = modal(`<h2>Buka kas</h2><label class="field"><span>Modal awal di laci (uang kembalian)</span><input class="big-input" data-v inputmode="numeric" placeholder="0"></label>
      <div class="foot"><button class="btn ghost" data-close>Batal</button><button class="btn" data-ok>Buka kas</button></div>`);
    const v = m.querySelector('[data-v]');
    v.addEventListener('input', () => { v.value = v.value ? num(v.value).toLocaleString('id-ID') : ''; });
    m.querySelector('[data-ok]').addEventListener('click', async () => {
      try { await api('/api/shift/open', { method: 'POST', body: { opening_cash: num(v.value) } }); m.close(); toast('Kas dibuka'); loadKas(); } catch (e) { fail(e); }
    });
  }
  function closeKas(shift) {
    const m = modal(`<h2>Tutup kas</h2>
      <p class="muted">Hitung semua uang tunai di laci, lalu isi di bawah.</p>
      <div class="kas-nums"><div><span>Modal</span><b>${rupiah(shift.opening_cash)}</b></div><div><span>Tunai masuk</span><b>${rupiah(shift.tunai)}</b></div><div class="hl"><span>Seharusnya</span><b>${rupiah(shift.expected)}</b></div></div>
      <label class="field" style="margin-top:14px"><span>Uang di laci sekarang</span><input class="big-input" data-v inputmode="numeric"></label>
      <div class="change" data-diff hidden></div>
      <label class="field" style="margin-top:12px"><span>Catatan (opsional)</span><input data-n maxlength="200" placeholder="mis. selisih karena ambil uang belanja es"></label>
      <div class="foot"><button class="btn ghost" data-close>Batal</button><button class="btn amber" data-ok>Tutup kas</button></div>`);
    const v = m.querySelector('[data-v]'); const d = m.querySelector('[data-diff]');
    v.addEventListener('input', () => {
      v.value = v.value ? num(v.value).toLocaleString('id-ID') : '';
      const diff = num(v.value) - shift.expected;
      d.hidden = !v.value;
      d.innerHTML = diff === 0 ? '<span>Pas</span><b>Rp0</b>' : `<span class="${diff < 0 ? 'bad' : ''}">${diff < 0 ? 'Kurang' : 'Lebih'}</span><b class="${diff < 0 ? 'bad' : ''}">${rupiah(Math.abs(diff))}</b>`;
    });
    m.querySelector('[data-ok]').addEventListener('click', async () => {
      if (!v.value) return toast('Isi jumlah uang di laci', true);
      try {
        const { shift: s } = await api('/api/shift/close', { method: 'POST', body: { counted_cash: num(v.value), note: m.querySelector('[data-n]').value } });
        m.close();
        const diff = s.counted_cash - s.expected_cash;
        toast(diff === 0 ? 'Kas ditutup — uang pas' : `Kas ditutup — ${diff < 0 ? 'kurang' : 'lebih'} ${rupiah(Math.abs(diff))}`, diff < 0);
        loadKas();
      } catch (e) { fail(e); }
    });
  }
  loadKas().catch(fail);

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
