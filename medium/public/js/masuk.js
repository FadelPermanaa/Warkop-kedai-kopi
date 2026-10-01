'use strict';
(async () => {
  const { $, $$, esc, rupiah, api, toast, fail, modal, time } = App;
  await App.boot('masuk');
  const main = $('#main');
  let data = { pending: [], recent: [] };
  let openBills = [];

  const items = (r) => `<ul class="req-items">${r.items.map((i) => `<li><span>${i.qty}× ${esc(i.name)}${i.note ? `<em>${esc(i.note)}</em>` : ''}</span><span class="num">${rupiah(i.price * i.qty)}</span></li>`).join('')}</ul>`;

  function render() {
    main.innerHTML = `
      <div class="page-head"><div><h1>Pesanan masuk</h1><p>Pesanan dari pelanggan lewat QR di meja. Terima untuk memasukkannya ke bon meja.</p></div></div>
      ${data.pending.length ? `<div class="req-grid">${data.pending.map((r) => {
        const bills = openBills.filter((o) => o.table_id === r.table_id);
        return `
        <article class="card req">
          <div class="req-head"><div><b class="req-table">${esc(r.table_name)}</b><span class="muted small">${esc(r.customer_name)} · ${time(r.created_at)}</span></div><span class="chip amber">Baru</span></div>
          ${items(r)}
          ${r.note ? `<p class="note">Catatan: ${esc(r.note)}</p>` : ''}
          <div class="req-total"><span>Total</span><b>${rupiah(r.total)}</b></div>
          ${bills.length ? `<label class="field"><span>Masukkan ke</span><select data-into="${r.id}">
            ${bills.map((o) => `<option value="${o.id}">Bon ${esc(o.code)}${o.customer_name ? ' · ' + esc(o.customer_name) : ''} (${rupiah(o.total)})</option>`).join('')}
            <option value="">Bon baru untuk ${esc(r.customer_name)}</option></select></label>` : ''}
          <div class="actions"><button class="btn ghost" data-reject="${r.id}">Tolak</button><button class="btn ok" data-accept="${r.id}" style="flex:1">Terima</button></div>
        </article>`;
      }).join('')}</div>` : '<div class="card empty"><b>Belum ada pesanan baru.</b><br>Halaman ini memeriksa otomatis dan berbunyi saat ada pesanan masuk.</div>'}
      ${data.recent.length ? `<h2 style="margin:28px 0 12px">Baru diproses</h2>
      <div class="card"><div class="table-wrap"><table class="data stack"><thead><tr><th>Jam</th><th>Meja</th><th>Nama</th><th class="num">Total</th><th>Hasil</th></tr></thead><tbody>
        ${data.recent.map((r) => `<tr><td data-label="Jam">${time(r.created_at)}</td><td data-label="Meja">${esc(r.table_name)}</td><td data-label="Nama">${esc(r.customer_name)}</td><td data-label="Total" class="num">${rupiah(r.total)}</td>
          <td data-label="Hasil">${r.status === 'accepted' ? `<span class="chip ok">Diterima</span> <span class="muted small">bon ${esc(r.order_code || '-')}</span>` : `<span class="chip bad">Ditolak</span> <span class="muted small">${esc(r.reject_reason)}</span>`}</td></tr>`).join('')}
      </tbody></table></div></div>` : ''}`;

    $$('[data-accept]').forEach((b) => b.addEventListener('click', async () => {
      const rid = Number(b.dataset.accept);
      const sel = $(`[data-into="${rid}"]`);
      b.disabled = true;
      try {
        const r = await api(`/api/incoming/${rid}/accept`, { method: 'POST', body: { order_id: sel ? Number(sel.value) || null : null } });
        toast(`Masuk ke bon ${r.order.code}`);
        load();
      } catch (e) { fail(e); b.disabled = false; }
    }));
    $$('[data-reject]').forEach((b) => b.addEventListener('click', () => {
      const m = modal(`<h2>Tolak pesanan?</h2>
        <label class="field"><span>Alasan (dilihat pelanggan)</span><input data-v maxlength="120" value="Maaf, menu yang dipesan sedang habis."></label>
        <div class="chips-pick">${['Menu sedang habis', 'Dapur sudah tutup', 'Pesanan dobel', 'Silakan pesan langsung ke kasir'].map((s) => `<button class="chip" data-s="${s}">${s}</button>`).join('')}</div>
        <div class="foot"><button class="btn ghost" data-close>Batal</button><button class="btn danger" data-ok>Tolak pesanan</button></div>`);
      $$('[data-s]', m).forEach((c) => c.addEventListener('click', () => { m.querySelector('[data-v]').value = 'Maaf, ' + c.dataset.s.toLowerCase() + '.'; }));
      m.querySelector('[data-ok]').addEventListener('click', async () => {
        try { await api(`/api/incoming/${b.dataset.reject}/reject`, { method: 'POST', body: { reason: m.querySelector('[data-v]').value } }); m.close(); toast('Pesanan ditolak'); load(); } catch (e) { fail(e); }
      });
    }));
  }

  async function load() {
    [data, { orders: openBills }] = await Promise.all([api('/api/incoming'), api('/api/orders/open')]);
    // Do not re-render while the cashier is choosing a bill or typing a reason.
    if (document.querySelector('.modal-back') || (document.activeElement && document.activeElement.tagName === 'SELECT')) return;
    render();
  }
  await load().catch(fail);
  document.addEventListener('incoming', () => load().catch(() => {}));
})();
