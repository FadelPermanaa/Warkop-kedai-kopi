'use strict';
(async () => {
  const { $, $$, esc, rupiah, num, api, toast, fail, modal, confirmBox } = App;
  await App.boot('menu', { owner: true });
  const main = $('#main');
  let data = { categories: [], products: [], tags: [] };
  let filter = '';

  async function load() { data = await api('/api/admin/menu'); render(); }

  function render() {
    const cats = data.categories;
    const name = (id) => (cats.find((c) => c.id === id) || {}).name || 'Tanpa kategori';
    const rows = data.products.filter((p) => !filter || p.name.toLowerCase().includes(filter));
    main.innerHTML = `
      <div class="page-head">
        <div><h1>Menu &amp; harga</h1><p>Perubahan langsung dipakai di kasir dan di halaman pesan pelanggan.</p></div>
        <div class="actions"><button class="btn ghost" data-cats>Kategori</button><button class="btn" data-add>+ Tambah menu</button></div>
      </div>
      <div class="card">
        <div class="card-head"><input type="search" placeholder="Cari menu…" value="${esc(filter)}" data-search style="max-width:280px"><span class="muted small">${data.products.length} menu</span></div>
        <div class="table-wrap"><table class="data stack">
          <thead><tr><th>Menu</th><th>Kategori</th><th class="num">Harga</th><th>Stok</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows.map((p) => `
            <tr>
              <td data-label="Menu"><b>${esc(p.name)}</b> ${p.tag ? `<span class="chip amber">${esc(p.tag)}</span>` : ''}<div class="muted small">${esc(p.description)}</div></td>
              <td data-label="Kategori">${esc(name(p.category_id))}</td>
              <td data-label="Harga" class="num">${rupiah(p.price)}</td>
              <td data-label="Stok">${p.track_stock ? `<span class="chip ${p.stock <= 0 ? 'bad' : p.low_stock ? 'amber' : 'grey'}">${p.stock} tersisa</span>` : '<span class="muted small">tidak dihitung</span>'}</td>
              <td data-label="Status"><label class="check"><input type="checkbox" data-avail="${p.id}" ${p.available ? 'checked' : ''}> ${p.available ? 'Tersedia' : 'Habis'}</label></td>
              <td class="num"><button class="btn ghost sm" data-edit="${p.id}">Ubah</button></td>
            </tr>`).join('') || '<tr><td colspan="6" class="empty">Belum ada menu.</td></tr>'}</tbody>
        </table></div>
      </div>`;
    $('[data-search]').addEventListener('input', (e) => { filter = e.target.value.toLowerCase(); const pos = e.target.selectionStart; render(); const s = $('[data-search]'); s.focus(); s.setSelectionRange(pos, pos); });
    $('[data-add]').addEventListener('click', () => edit(null));
    $('[data-cats]').addEventListener('click', categories);
    $$('[data-edit]').forEach((b) => b.addEventListener('click', () => edit(data.products.find((p) => p.id === Number(b.dataset.edit)))));
    $$('[data-avail]').forEach((c) => c.addEventListener('change', async () => {
      try { await api(`/api/admin/products/${c.dataset.avail}`, { method: 'PUT', body: { available: c.checked } }); toast(c.checked ? 'Menu tersedia lagi' : 'Ditandai habis'); load(); } catch (e) { fail(e); }
    }));
  }

  function edit(p) {
    const isNew = !p;
    p = p || { name: '', description: '', price: '', category_id: data.categories[0]?.id, tag: '', available: true, track_stock: false, min_stock: 0 };
    const m = modal(`
      <h2>${isNew ? 'Tambah menu' : 'Ubah menu'}</h2>
      <form class="grid" data-form>
        <label class="field"><span>Nama menu</span><input name="name" value="${esc(p.name)}" required maxlength="60"></label>
        <div class="form-row">
          <label class="field"><span>Harga (Rp)</span><input name="price" inputmode="numeric" value="${p.price === '' ? '' : p.price}" required></label>
          <label class="field"><span>Kategori</span><select name="category_id">${data.categories.map((c) => `<option value="${c.id}" ${c.id === p.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
          <label class="field"><span>Label</span><select name="tag">${data.tags.map((t) => `<option value="${esc(t)}" ${t === p.tag ? 'selected' : ''}>${t || '—'}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>Keterangan singkat</span><input name="description" value="${esc(p.description)}" maxlength="160"></label>
        <label class="check"><input type="checkbox" name="available" ${p.available ? 'checked' : ''}> Tersedia untuk dijual</label>
        <label class="check"><input type="checkbox" name="track_stock" ${p.track_stock ? 'checked' : ''}> Hitung stok menu ini</label>
        <label class="field" data-min ${p.track_stock ? '' : 'hidden'}><span>Peringatan kalau stok tinggal</span><input name="min_stock" inputmode="numeric" value="${p.min_stock}"></label>
        <p class="small muted" data-min ${p.track_stock ? '' : 'hidden'}>Jumlah stok diisi di halaman Stok (tambah stok / stok opname).</p>
      </form>
      <div class="foot">${isNew ? '' : '<button class="btn danger" data-del style="margin-right:auto">Hapus</button>'}<button class="btn ghost" data-close>Batal</button><button class="btn" data-save>Simpan</button></div>`);
    const form = m.querySelector('[data-form]');
    form.track_stock.addEventListener('change', () => m.querySelectorAll('[data-min]').forEach((el) => { el.hidden = !form.track_stock.checked; }));
    const save = async () => {
      const body = { name: form.name.value, price: num(form.price.value), category_id: Number(form.category_id.value), tag: form.tag.value, description: form.description.value, available: form.available.checked, track_stock: form.track_stock.checked, min_stock: num(form.min_stock.value) };
      if (!form.price.value.trim()) return fail(new Error('Harga wajib diisi.'));
      try {
        await api(isNew ? '/api/admin/products' : `/api/admin/products/${p.id}`, { method: isNew ? 'POST' : 'PUT', body });
        m.close(); toast('Menu disimpan'); load();
      } catch (e) { fail(e); }
    };
    m.querySelector('[data-save]').addEventListener('click', save);
    form.addEventListener('submit', (e) => { e.preventDefault(); save(); });
    const del = m.querySelector('[data-del]');
    if (del) del.addEventListener('click', async () => {
      if (!(await confirmBox(`Hapus "${p.name}" dari menu? Riwayat penjualannya tetap tersimpan.`, { ok: 'Hapus', danger: true }))) return;
      try { await api(`/api/admin/products/${p.id}`, { method: 'DELETE', body: {} }); m.close(); toast('Menu dihapus'); load(); } catch (e) { fail(e); }
    });
  }

  function categories() {
    const m = modal(`
      <h2>Kategori</h2>
      <div class="grid" data-list></div>
      <form class="actions" data-new style="margin-top:14px"><input name="name" placeholder="Kategori baru" maxlength="40" style="flex:1"><button class="btn">Tambah</button></form>
      <div class="foot"><button class="btn ghost" data-close>Selesai</button></div>`, { onClose: load });
    const draw = () => {
      m.querySelector('[data-list]').innerHTML = data.categories.map((c) => `
        <div class="actions"><input value="${esc(c.name)}" data-cat="${c.id}" style="flex:1" maxlength="40"><button class="btn ghost sm" data-save-cat="${c.id}">Simpan</button><button class="btn ghost sm" data-del-cat="${c.id}">Hapus</button></div>`).join('');
      m.querySelectorAll('[data-save-cat]').forEach((b) => b.addEventListener('click', async () => {
        const id = b.dataset.saveCat; const c = data.categories.find((x) => x.id === Number(id));
        try { await api(`/api/admin/categories/${id}`, { method: 'PUT', body: { name: m.querySelector(`[data-cat="${id}"]`).value, sort: c.sort } }); toast('Kategori disimpan'); data = await api('/api/admin/menu'); draw(); } catch (e) { fail(e); }
      }));
      m.querySelectorAll('[data-del-cat]').forEach((b) => b.addEventListener('click', async () => {
        try { await api(`/api/admin/categories/${b.dataset.delCat}`, { method: 'DELETE', body: {} }); data = await api('/api/admin/menu'); draw(); } catch (e) { fail(e); }
      }));
    };
    draw();
    m.querySelector('[data-new]').addEventListener('submit', async (e) => {
      e.preventDefault();
      try { await api('/api/admin/categories', { method: 'POST', body: { name: e.target.name.value } }); e.target.reset(); data = await api('/api/admin/menu'); draw(); } catch (err) { fail(err); }
    });
  }

  load().catch(fail);
})();
