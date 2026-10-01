'use strict';
(async () => {
  const { $, $$, esc, rupiah, api, fail } = App;
  await App.boot('laporan', { owner: true });
  const main = $('#main');
  const iso = (d) => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const now = new Date();
  const PRESETS = {
    today: ['Hari ini', () => [iso(now), iso(now)]],
    yesterday: ['Kemarin', () => { const d = new Date(now); d.setDate(d.getDate() - 1); return [iso(d), iso(d)]; }],
    week: ['7 hari', () => { const d = new Date(now); d.setDate(d.getDate() - 6); return [iso(d), iso(now)]; }],
    month: ['Bulan ini', () => [iso(new Date(now.getFullYear(), now.getMonth(), 1)), iso(now)]],
    last: ['Bulan lalu', () => [iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), iso(new Date(now.getFullYear(), now.getMonth(), 0))]],
  };
  let preset = 'today';
  let [from, to] = PRESETS.today[1]();
  let tab = 'ringkasan';

  const fmtDay = (d) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const bars = (rows, label, value, fmt = rupiah) => {
    const max = Math.max(1, ...rows.map(value));
    return `<div class="hbars">${rows.map((r) => `<div class="hbar"><span class="hbar-l">${label(r)}</span><span class="hbar-t"><i style="width:${(value(r) / max) * 100}%"></i></span><span class="hbar-v num">${fmt(value(r))}</span></div>`).join('')}</div>`;
  };

  main.innerHTML = `
    <div class="page-head"><div><h1>Laporan</h1><p data-sub></p></div>
      <div class="actions"><a class="btn ghost sm" data-csv="transaksi">Unduh transaksi (Excel)</a><a class="btn ghost sm" data-csv="menu">Unduh penjualan menu</a></div></div>
    <div class="card filters">
      <div class="seg" data-presets>${Object.entries(PRESETS).map(([k, [n]]) => `<button data-p="${k}" class="${k === preset ? 'on' : ''}">${n}</button>`).join('')}</div>
      <span class="actions"><input type="date" data-from aria-label="Dari tanggal"> <span class="muted">s/d</span> <input type="date" data-to aria-label="Sampai tanggal"></span>
    </div>
    <div class="seg tabs" data-tabs style="margin:16px 0">
      <button data-t="ringkasan" class="on">Ringkasan</button><button data-t="menu">Menu</button><button data-t="kas">Tutup kas</button><button data-t="aktivitas">Aktivitas</button>
    </div>
    <div data-body></div>`;

  async function load() {
    $('[data-from]').value = from; $('[data-to]').value = to;
    $$('[data-csv]').forEach((a) => { a.href = `/api/admin/report.csv?kind=${a.dataset.csv}&from=${from}&to=${to}`; });
    const body = $('[data-body]');
    if (tab === 'aktivitas') {
      const { entries } = await api('/api/admin/audit');
      $('[data-sub]').textContent = '300 aktivitas terakhir';
      body.innerHTML = `<div class="card"><div class="table-wrap"><table class="data stack"><thead><tr><th>Waktu</th><th>Oleh</th><th>Aktivitas</th><th>Detail</th></tr></thead><tbody>
        ${entries.map((e) => `<tr><td data-label="Waktu">${esc(e.at.slice(5, 16).replace('-', '/'))}</td><td data-label="Oleh">${esc(e.user_name || '-')}</td><td data-label="Aktivitas"><span class="chip ${/batal|gagal|tolak|kurangi|diskon|harga/.test(e.action) ? 'amber' : 'grey'}">${esc(e.action)}</span></td><td data-label="Detail">${esc(e.detail)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
      return;
    }
    const r = await api(`/api/admin/report?from=${from}&to=${to}`);
    $('[data-sub]').textContent = r.from === r.to ? App.dateLong(r.from) : `${App.dateLong(r.from)} – ${App.dateLong(r.to)}`;
    const method = Object.fromEntries(r.methods.map((m) => [m.method, m.amount]));
    if (tab === 'ringkasan') {
      const hours = Array.from({ length: 24 }, (_, h) => r.hours.find((x) => x.hour === h) || { hour: h, n: 0, total: 0 }).filter((h, i, a) => a.slice(0, i + 1).some((x) => x.n) && a.slice(i).some((x) => x.n));
      const peak = r.hours.slice().sort((a, b) => b.n - a.n)[0];
      body.innerHTML = `
        <div class="grid grid-4">
          <div class="stat blue"><span>Pendapatan</span><b>${rupiah(r.total)}</b></div>
          <div class="stat"><span>Transaksi</span><b>${r.count}</b></div>
          <div class="stat"><span>Rata-rata per bon</span><b>${rupiah(r.average)}</b></div>
          <div class="stat amber"><span>Jam paling ramai</span><b>${peak ? `${String(peak.hour).padStart(2, '0')}.00` : '—'}</b></div>
        </div>
        <div class="grid grid-2" style="margin-top:16px">
          <div class="card"><div class="card-head"><h2>Cara bayar</h2></div>
            ${bars([{ n: 'Tunai', v: method.tunai || 0 }, { n: 'QRIS', v: method.qris || 0 }], (x) => x.n, (x) => x.v)}
            <p class="muted small">Diskon diberikan ${rupiah(r.discount)} · ${r.void_count} bon dibatalkan (${rupiah(r.void_total)})</p></div>
          <div class="card"><div class="card-head"><h2>Menu terlaris</h2><button class="link" data-goto="menu">Lihat semua</button></div>
            ${r.items.length ? bars(r.items.slice(0, 5), (x) => esc(x.name), (x) => x.qty, (n) => n + '×') : '<div class="empty">Belum ada penjualan.</div>'}</div>
        </div>
        ${r.days.length > 1 ? `<div class="card"><div class="card-head"><h2>Per hari</h2></div>${bars(r.days, (d) => fmtDay(d.day), (d) => d.total)}</div>` : ''}
        <div class="card"><div class="card-head"><h2>Jam ramai</h2><span class="muted small">jumlah bon dibayar per jam</span></div>
          ${hours.length ? `<div class="vbars">${hours.map((h) => { const max = Math.max(...hours.map((x) => x.n)); return `<div class="vbar" title="${h.n} bon · ${rupiah(h.total)}"><i style="height:${(h.n / max) * 100}%"></i><span>${String(h.hour).padStart(2, '0')}</span><b>${h.n || ''}</b></div>`; }).join('')}</div>` : '<div class="empty">Belum ada penjualan.</div>'}
        </div>
        <div class="grid grid-2" style="margin-top:16px">
          <div class="card"><div class="card-head"><h2>Per kategori</h2></div>${r.categories.length ? bars(r.categories, (c) => esc(c.name), (c) => c.total) : '<div class="empty">—</div>'}</div>
          <div class="card"><div class="card-head"><h2>Per kasir</h2></div>${r.cashiers.length ? bars(r.cashiers, (c) => `${esc(c.name)} <small class="muted">(${c.n})</small>`, (c) => c.total) : '<div class="empty">—</div>'}
            ${r.sources.length ? `<p class="muted small">${r.sources.map((s) => `${s.source === 'meja' ? 'Pesan dari QR meja' : s.type === 'take_away' ? 'Bawa pulang' : 'Makan di sini (kasir)'}: ${s.n} bon`).join(' · ')}</p>` : ''}</div>
        </div>`;
      const g = $('[data-goto]');
      if (g) g.addEventListener('click', () => setTab('menu'));
    } else if (tab === 'menu') {
      body.innerHTML = `<div class="card"><div class="table-wrap"><table class="data stack"><thead><tr><th>#</th><th>Menu</th><th>Kategori</th><th class="num">Terjual</th><th class="num">Pendapatan</th></tr></thead><tbody>
        ${r.items.map((it, i) => `<tr><td data-label="#">${i + 1}</td><td data-label="Menu"><b>${esc(it.name)}</b></td><td data-label="Kategori">${esc(it.category || '-')}</td><td data-label="Terjual" class="num">${it.qty}</td><td data-label="Pendapatan" class="num">${rupiah(it.total)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Belum ada penjualan.</td></tr>'}
      </tbody></table></div></div>`;
    } else if (tab === 'kas') {
      body.innerHTML = `<div class="card"><div class="table-wrap"><table class="data stack"><thead><tr><th>Dibuka</th><th>Ditutup</th><th class="num">Modal</th><th class="num">Tunai</th><th class="num">QRIS</th><th class="num">Seharusnya</th><th class="num">Dihitung</th><th class="num">Selisih</th></tr></thead><tbody>
        ${r.shifts.map((s) => { const diff = s.closed_at ? s.counted_cash - s.expected_cash : null; return `<tr>
          <td data-label="Dibuka">${esc(s.opened_at.slice(5, 16).replace('-', '/'))}<br><small class="muted">${esc(s.opened_by_name || '')}</small></td>
          <td data-label="Ditutup">${s.closed_at ? `${esc(s.closed_at.slice(5, 16).replace('-', '/'))}<br><small class="muted">${esc(s.closed_by_name || '')}</small>` : '<span class="chip amber">Masih buka</span>'}</td>
          <td data-label="Modal" class="num">${rupiah(s.opening_cash)}</td><td data-label="Tunai" class="num">${rupiah(s.tunai)}</td><td data-label="QRIS" class="num">${rupiah(s.qris)}</td>
          <td data-label="Seharusnya" class="num">${rupiah(s.expected)}</td><td data-label="Dihitung" class="num">${s.closed_at ? rupiah(s.counted_cash) : '—'}</td>
          <td data-label="Selisih" class="num">${diff === null ? '—' : `<span class="chip ${diff === 0 ? 'ok' : diff < 0 ? 'bad' : 'amber'}">${diff > 0 ? '+' : ''}${rupiah(diff).replace('Rp-', '−Rp')}</span>`}${s.note ? `<br><small class="muted">${esc(s.note)}</small>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="8" class="empty">Belum ada kas yang dibuka di periode ini. Kasir membuka &amp; menutup kas dari halaman Riwayat.</td></tr>'}
      </tbody></table></div></div>`;
    }
  }
  function setTab(t) { tab = t; $$('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === t)); load().catch(fail); }

  $$('[data-p]').forEach((b) => b.addEventListener('click', () => {
    preset = b.dataset.p; [from, to] = PRESETS[preset][1]();
    $$('[data-p]').forEach((x) => x.classList.toggle('on', x === b));
    load().catch(fail);
  }));
  const custom = () => { from = $('[data-from]').value || from; to = $('[data-to]').value || to; $$('[data-p]').forEach((x) => x.classList.remove('on')); load().catch(fail); };
  $('[data-from]').addEventListener('change', custom);
  $('[data-to]').addEventListener('change', custom);
  $$('[data-t]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.t)));
  load().catch(fail);
})();
