'use strict';
(async () => {
  const { $, $$, esc, api, toast, fail, modal } = App;
  const me = await App.boot('stok');
  const owner = me.role === 'pemilik';
  const main = $('#main');
  let data;

  const state = (p) => (p.stock <= 0 ? '<span class="chip bad">Habis</span>' : p.low_stock ? '<span class="chip amber">Menipis</span>' : '<span class="chip ok">Aman</span>');

  const rank = (p) => (p.stock <= 0 ? 0 : p.low_stock ? 1 : 2);
  async function load() { data = await api('/api/stock'); render(); }
  function render() {
    const tracked = data.products.filter((p) => p.track_stock).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    const low = tracked.filter((p) => p.low_stock);
    const untracked = data.products.filter((p) => !p.track_stock);
    main.innerHTML = `
      <div class="page-head"><div><h1>Stok</h1><p>Stok berkurang otomatis setiap ada pesanan dan kembali kalau bon dibatalkan. Menu yang habis tidak bisa dipesan.</p></div></div>
      ${low.length ? `<div class="alert" style="margin-bottom:16px"><b>${low.length} menu perlu diisi ulang:</b> ${low.map((p) => `${esc(p.name)} (${p.stock})`).join(', ')}</div>` : ''}
      <div class="card">
        <div class="card-head"><h2>Menu yang dihitung stoknya</h2></div>
        ${tracked.length ? `<div class="table-wrap"><table class="data stack">
          <thead><tr><th>Menu</th><th class="num">Stok</th><th class="num">Batas menipis</th><th>Status</th><th></th></tr></thead>
          <tbody>${tracked.map((p) => `<tr>
            <td data-label="Menu"><b>${esc(p.name)}</b></td>
            <td data-label="Stok" class="num"><b>${p.stock}</b></td>
            <td data-label="Batas" class="num">${p.min_stock}</td>
            <td data-label="Status">${state(p)}</td>
            <td class="num"><div class="actions" style="justify-content:flex-end">
              <button class="btn sm" data-adj="${p.id}" data-mode="masuk">+ Stok masuk</button>
              ${owner ? `<button class="btn ghost sm" data-adj="${p.id}" data-mode="opname">Hitung ulang</button><button class="btn ghost sm" data-adj="${p.id}" data-mode="rusak">Rusak</button>` : ''}
            </div></td></tr>`).join('')}</tbody>
        </table></div>` : `<div class="empty">Belum ada menu yang dihitung stoknya.${owner ? ' Buka <a href="/menu">Menu</a>, ubah item (mis. gorengan atau Indomie), lalu nyalakan <b>Hitung stok</b>.' : ''}</div>`}
        ${tracked.length && untracked.length ? `<p class="muted small" style="margin:12px 0 0">${untracked.length} menu lain tidak dihitung stoknya (mis. minuman yang dibuat dari bahan).${owner ? ' Atur di halaman <a href="/menu">Menu</a>.' : ''}</p>` : ''}
      </div>
      <div class="card">
        <div class="card-head"><h2>Riwayat stok</h2></div>
        <div class="table-wrap"><table class="data stack">
          <thead><tr><th>Waktu</th><th>Menu</th><th>Jenis</th><th class="num">Perubahan</th><th class="num">Sisa</th><th>Oleh</th></tr></thead>
          <tbody>${data.moves.map((m) => `<tr>
            <td data-label="Waktu">${esc(m.created_at.slice(5, 16).replace('-', '/'))}</td>
            <td data-label="Menu">${esc(m.product_name)}</td>
            <td data-label="Jenis">${esc(data.reasons[m.reason] || m.reason)}${m.ref ? ` <span class="muted small">${esc(m.ref)}</span>` : ''}</td>
            <td data-label="Perubahan" class="num ${m.delta < 0 ? 'neg' : 'pos'}">${m.delta > 0 ? '+' : ''}${m.delta}</td>
            <td data-label="Sisa" class="num">${m.stock_after}</td>
            <td data-label="Oleh">${esc(m.user_name || '-')}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Belum ada perubahan stok.</td></tr>'}</tbody>
        </table></div>
      </div>`;
    $$('[data-adj]').forEach((b) => b.addEventListener('click', () => adjust(data.products.find((p) => p.id === Number(b.dataset.adj)), b.dataset.mode)));
  }

  function adjust(p, mode) {
    const T = {
      masuk: ['Stok masuk', `Berapa ${p.name} yang ditambahkan?`, 'Jumlah masuk', 'mis. goreng 20 potong'],
      opname: ['Hitung ulang stok', `Isi jumlah ${p.name} yang benar-benar ada sekarang.`, 'Jumlah sebenarnya', 'mis. cek akhir hari'],
      rusak: ['Rusak / terbuang', `Berapa ${p.name} yang rusak atau terbuang?`, 'Jumlah rusak', 'mis. gosong'],
    }[mode];
    const m = modal(`<h2>${T[0]}</h2><p class="muted">${esc(T[1])} Stok sekarang: <b>${p.stock}</b>.</p>
      <div class="form-row"><label class="field"><span>${T[2]}</span><input data-q type="number" min="0" inputmode="numeric" ${mode === 'opname' ? `value="${p.stock}"` : ''}></label>
      <label class="field"><span>Keterangan (opsional)</span><input data-n maxlength="100" placeholder="${esc(T[3])}"></label></div>
      <div class="foot"><button class="btn ghost" data-close>Batal</button><button class="btn" data-ok>Simpan</button></div>`);
    const ok = async () => {
      try {
        await api('/api/stock/' + p.id, { method: 'POST', body: { mode, qty: m.querySelector('[data-q]').value, note: m.querySelector('[data-n]').value } });
        m.close(); toast('Stok tersimpan'); load();
      } catch (e) { fail(e); }
    };
    m.querySelector('[data-ok]').addEventListener('click', ok);
    m.querySelector('[data-q]').addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
  }

  load().catch(fail);
})();
