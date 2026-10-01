/* Bill detail modal shared by "Meja & bon" and "Riwayat": move, merge, split, print, void. */
'use strict';
(function () {
  const { $$, esc, rupiah, api, toast, fail, modal, confirmBox, time } = App;
  const METHOD = { tunai: 'Tunai', qris: 'QRIS' };
  const STATUS = { open: '<span class="chip amber">Belum bayar</span>', paid: '<span class="chip ok">Lunas</span>', void: '<span class="chip bad">Dibatalkan</span>' };
  const printBill = (id) => window.open('/struk?id=' + id + '&print=1', 'struk', 'width=420,height=700');

  async function show(id, { onChange = () => {} } = {}) {
    let o;
    try { ({ order: o } = await api('/api/orders/' + id)); } catch (e) { return fail(e); }
    const owner = App.user.role === 'pemilik';
    const m = modal(`
      <div class="bill-head"><div><span class="muted small">Bon ${esc(o.code)} · dibuka ${time(o.opened_at)}${o.opened_by_name ? ' oleh ' + esc(o.opened_by_name) : ''}${o.source === 'meja' ? ' · dari QR meja' : ''}</span><h2>${esc(o.label)}</h2></div>${STATUS[o.status]}</div>
      ${o.note ? `<p class="note">Catatan: ${esc(o.note)}</p>` : ''}
      <table class="data"><tbody>
        ${o.items.map((it) => `<tr><td>${it.qty}× ${esc(it.name)}${it.note ? `<div class="note">${esc(it.note)}</div>` : ''}</td><td class="num">${rupiah(it.price * it.qty)}</td></tr>`).join('') || '<tr><td class="empty">Belum ada item</td></tr>'}
        ${o.discount ? `<tr><td>Diskon</td><td class="num">−${rupiah(o.discount)}</td></tr>` : ''}
        <tr><td><b>Total</b></td><td class="num"><b>${rupiah(o.total)}</b></td></tr>
        ${o.payments.map((p) => `<tr><td class="muted">${METHOD[p.method]}${p.method === 'tunai' && p.change ? ` (diterima ${rupiah(p.received)}, kembali ${rupiah(p.change)})` : ''}</td><td class="num muted">${rupiah(p.amount)}</td></tr>`).join('')}
      </tbody></table>
      ${o.status === 'paid' ? `<p class="muted small">Dibayar ${time(o.paid_at)}${o.paid_by_name ? ' · kasir ' + esc(o.paid_by_name) : ''}</p>` : ''}
      ${o.status === 'void' ? `<div class="alert bad">Dibatalkan ${esc(o.voided_at || '')}${o.voided_by_name ? ' oleh ' + esc(o.voided_by_name) : ''}: ${esc(o.void_reason)}</div>` : ''}
      <div class="foot bill-foot">
        ${o.status === 'open' ? `
          <button class="btn ghost sm" data-act="move">Pindah meja</button>
          <button class="btn ghost sm" data-act="merge">Gabung</button>
          <button class="btn ghost sm" data-act="split" ${o.items.reduce((s, i) => s + i.qty, 0) < 2 ? 'disabled' : ''}>Pisah bon</button>
          <button class="btn ghost sm" data-act="bill">Cetak tagihan</button>
          ${owner && o.items.length ? '<button class="btn ghost sm danger-text" data-act="void">Batalkan</button>' : ''}
          ${!o.items.length ? '<button class="btn ghost sm danger-text" data-act="discard">Hapus</button>' : ''}
          <span class="spacer"></span>
          <a class="btn ghost" href="/kasir?order=${o.id}">Tambah item</a>
          <a class="btn amber" href="/kasir?order=${o.id}&pay=1">Bayar</a>` : ''}
        ${o.status === 'paid' ? `
          ${owner ? '<button class="btn ghost danger-text" data-act="void">Batalkan transaksi</button>' : ''}
          <span class="spacer"></span>
          <button class="btn" data-act="bill">Cetak ulang struk</button>` : ''}
        ${o.status === 'void' ? '<button class="btn ghost" data-close>Tutup</button>' : ''}
      </div>`, { wide: true });

    const after = (msg) => { m.close(); toast(msg); onChange(); };
    const acts = {
      bill: () => printBill(o.id),
      move: async () => {
        const { tables } = await api('/api/tables');
        const p = modal(`<h2>Pindah ${esc(o.label)}</h2>
          <label class="field"><span>Pindah ke</span><select data-v>
            <option value="">Bawa pulang (tanpa meja)</option>
            ${tables.map((t) => `<option value="${t.id}" ${t.id === o.table_id ? 'selected' : ''}>${esc(t.name)}${t.orders.some((x) => x.id !== o.id) ? ' · ada bon' : ''}</option>`).join('')}
          </select></label>
          <div class="foot"><button class="btn ghost" data-close>Batal</button><button class="btn" data-ok>Pindahkan</button></div>`);
        p.querySelector('[data-ok]').addEventListener('click', async () => {
          try { await api(`/api/orders/${o.id}/move`, { method: 'POST', body: { table_id: Number(p.querySelector('[data-v]').value) || null } }); p.close(); after('Bon dipindah'); } catch (e) { fail(e); }
        });
      },
      merge: async () => {
        const { orders } = await api('/api/orders/open');
        const others = orders.filter((x) => x.id !== o.id);
        if (!others.length) return toast('Tidak ada bon lain yang terbuka', true);
        const p = modal(`<h2>Gabung bon</h2><p class="muted">Semua item ${esc(o.label)} dipindah ke bon yang dipilih. Bon ${esc(o.code)} lalu hilang.</p>
          <div class="pick-list">${others.map((x) => `<label class="pick"><input type="radio" name="into" value="${x.id}"><span><b>${esc(x.label)}</b><small>${esc(x.code)} · ${x.item_count} item</small></span><span class="num">${rupiah(x.total)}</span></label>`).join('')}</div>
          <div class="foot"><button class="btn ghost" data-close>Batal</button><button class="btn" data-ok>Gabungkan</button></div>`);
        p.querySelector('[data-ok]').addEventListener('click', async () => {
          const r = p.querySelector('input[name=into]:checked');
          if (!r) return toast('Pilih bon tujuan', true);
          try { await api(`/api/orders/${o.id}/merge`, { method: 'POST', body: { into: Number(r.value) } }); p.close(); after('Bon digabung'); } catch (e) { fail(e); }
        });
      },
      split: () => {
        const p = modal(`<h2>Pisah bon</h2><p class="muted">Pilih item yang dipindah ke bon baru (misalnya untuk bayar sendiri-sendiri).</p>
          <div class="pick-list">${o.items.map((it) => `<div class="pick"><span><b>${esc(it.name)}</b><small>${rupiah(it.price)} · ada ${it.qty}</small></span>
            <span class="qty"><button data-d="-1" data-i="${it.id}">−</button><span data-n="${it.id}">0</span><button data-d="1" data-i="${it.id}">+</button></span></div>`).join('')}</div>
          <div class="sums" style="margin-top:12px"><div class="grand"><span>Bon baru</span><span class="num" data-sum>${rupiah(0)}</span></div></div>
          <div class="foot"><button class="btn ghost" data-close>Batal</button><button class="btn" data-ok>Pisahkan</button></div>`);
        const pick = {};
        const upd = () => { p.querySelector('[data-sum]').textContent = rupiah(o.items.reduce((s, it) => s + it.price * (pick[it.id] || 0), 0)); };
        $$('[data-i]', p).forEach((b) => b.addEventListener('click', () => {
          const it = o.items.find((x) => x.id === Number(b.dataset.i));
          pick[it.id] = Math.max(0, Math.min(it.qty, (pick[it.id] || 0) + Number(b.dataset.d)));
          p.querySelector(`[data-n="${it.id}"]`).textContent = pick[it.id];
          upd();
        }));
        p.querySelector('[data-ok]').addEventListener('click', async () => {
          const items = Object.entries(pick).filter(([, q]) => q > 0).map(([iid, qty]) => ({ id: Number(iid), qty }));
          try { const r = await api(`/api/orders/${o.id}/split`, { method: 'POST', body: { items } }); p.close(); after(`Bon baru ${r.order.code} dibuat`); } catch (e) { fail(e); }
        });
      },
      void: () => {
        const p = modal(`<h2>Batalkan ${esc(o.code)}?</h2>
          <p class="muted">${o.status === 'paid' ? 'Transaksi ini sudah dibayar. Uangnya dikembalikan ke pelanggan dan tidak dihitung di laporan.' : 'Bon ini dibatalkan dan tidak bisa dibayar lagi.'} Stok item dikembalikan.</p>
          <label class="field"><span>Alasan (wajib)</span><input data-v maxlength="120" placeholder="mis. salah input, pelanggan batal"></label>
          <div class="foot"><button class="btn ghost" data-close>Tidak jadi</button><button class="btn danger" data-ok>Batalkan bon</button></div>`);
        p.querySelector('[data-ok]').addEventListener('click', async () => {
          try { await api(`/api/orders/${o.id}/void`, { method: 'POST', body: { reason: p.querySelector('[data-v]').value } }); p.close(); after('Bon dibatalkan'); } catch (e) { fail(e); }
        });
      },
      discard: async () => {
        if (!(await confirmBox('Hapus bon kosong ini?', { ok: 'Hapus', danger: true }))) return;
        try { await api('/api/orders/' + o.id, { method: 'DELETE' }); after('Bon dihapus'); } catch (e) { fail(e); }
      },
    };
    $$('[data-act]', m).forEach((b) => b.addEventListener('click', () => Promise.resolve(acts[b.dataset.act]()).catch(fail)));
  }

  App.bon = { show, STATUS, METHOD };
})();
