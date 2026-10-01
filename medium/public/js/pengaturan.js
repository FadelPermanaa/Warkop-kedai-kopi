'use strict';
(async () => {
  const { $, $$, esc, api, toast, fail, confirmBox } = App;
  await App.boot('pengaturan', { owner: true });
  const main = $('#main');
  let s = {}; let tables = [];
  let qrisImage = null; // pending new image (data URL) or '' to remove

  async function load() { ({ settings: s, tables } = await api('/api/admin/settings')); qrisImage = null; render(); }

  const field = (key, label, attrs = '') => `<label class="field"><span>${label}</span><input name="${key}" value="${esc(s[key])}" ${attrs}></label>`;

  function render() {
    const img = qrisImage !== null ? qrisImage : s.qris_image;
    main.innerHTML = `
      <div class="page-head"><div><h1>Pengaturan</h1><p>Data warung yang muncul di struk, QRIS untuk pembayaran, dan meja.</p></div></div>
      <form data-form>
        <div class="grid grid-2">
          <section class="card">
            <div class="card-head"><h2>Warung</h2></div>
            <div class="grid">
              ${field('shop_name', 'Nama warung', 'maxlength="60" required')}
              ${field('shop_tagline', 'Slogan singkat', 'maxlength="80"')}
              ${field('shop_address', 'Alamat (dicetak di struk)', 'maxlength="120"')}
              ${field('shop_phone', 'No. HP / WhatsApp', 'maxlength="30" inputmode="tel"')}
              <div class="form-row">${field('open_time', 'Jam buka', 'type="time"')}${field('close_time', 'Jam tutup', 'type="time"')}</div>
              <label class="field"><span>Tulisan di bawah struk</span><textarea name="receipt_footer" maxlength="200">${esc(s.receipt_footer)}</textarea></label>
            </div>
          </section>
          <section class="card">
            <div class="card-head"><h2>QRIS</h2></div>
            <p class="muted small" style="margin-top:0">Unggah gambar QRIS statis warung (dari bank / e-wallet). Kasir menampilkannya ke pelanggan saat bayar pakai QRIS.</p>
            <div class="qris-box">${img ? `<img src="${esc(img)}" alt="QRIS warung">` : '<div class="empty">Belum ada gambar QRIS</div>'}</div>
            <div class="actions" style="margin-top:12px">
              <label class="btn ghost sm" for="qris-file">${img ? 'Ganti gambar' : 'Unggah gambar'}</label>
              <input id="qris-file" type="file" accept="image/png,image/jpeg,image/webp" hidden>
              ${img ? '<button type="button" class="btn ghost sm" data-qris-remove>Hapus</button>' : ''}
            </div>
            <div style="margin-top:12px">${field('qris_name', 'Nama di QRIS (opsional)', 'maxlength="60" placeholder="mis. WARKOP KITA BDG"')}</div>
          </section>
        </div>
        <section class="card">
          <div class="card-head"><h2>Meja &amp; pesan dari meja</h2><a class="btn ghost sm" href="/qr-meja">Cetak QR meja</a></div>
          <div class="grid">
            <label class="check"><input type="checkbox" name="table_ordering" ${s.table_ordering === '1' ? 'checked' : ''}> Pelanggan boleh pesan sendiri lewat QR di meja</label>
            <div class="form-row">
              <label class="field"><span>Jumlah meja</span><input name="table_count" type="number" min="0" max="200" value="${tables.length}"></label>
              ${field('public_url', 'Alamat untuk QR (opsional)', 'placeholder="mis. http://192.168.1.10:3300" inputmode="url"')}
            </div>
            <p class="muted small" style="margin:0">Alamat untuk QR dipakai kalau HP pelanggan membuka kasir lewat alamat lain (Wi-Fi warung atau domain). Kosongkan untuk memakai alamat yang sedang dibuka sekarang.</p>
          </div>
          <div class="table-wrap" style="margin-top:12px"><table class="data stack">
            <thead><tr><th>Meja</th><th>Nama</th><th></th></tr></thead>
            <tbody>${tables.map((t, i) => `<tr>
              <td data-label="No.">${i + 1}</td>
              <td data-label="Nama"><input data-table-name="${t.id}" value="${esc(t.name)}" maxlength="30" aria-label="Nama meja ${i + 1}"></td>
              <td class="num"><button type="button" class="btn ghost sm" data-reset="${t.id}" title="QR lama tidak bisa dipakai lagi">QR baru</button></td></tr>`).join('') || '<tr><td colspan="3" class="empty">Belum ada meja. Isi jumlah meja di atas.</td></tr>'}</tbody>
          </table></div>
        </section>
        <div class="save-bar"><button class="btn lg" data-save>Simpan pengaturan</button></div>
      </form>`;

    const f = $('[data-form]');
    f.addEventListener('submit', (e) => { e.preventDefault(); save(f); });
    $('#qris-file').addEventListener('change', (e) => pickQris(e.target.files[0]));
    const rm = $('[data-qris-remove]');
    if (rm) rm.addEventListener('click', () => { qrisImage = ''; render(); });
    $$('[data-reset]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmBox('Buat QR baru untuk meja ini? QR lama yang sudah ditempel tidak bisa dipakai lagi.', { ok: 'Buat QR baru' }))) return;
      try { await api(`/api/admin/tables/${b.dataset.reset}/reset-qr`, { method: 'POST', body: {} }); toast('QR baru dibuat. Cetak ulang QR meja ini.'); } catch (err) { fail(err); }
    }));
  }

  function pickQris(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return fail(new Error('Gambar harus PNG, JPG atau WEBP.'));
    if (file.size > 1_500_000) return fail(new Error('Gambar terlalu besar (maks. 1,5 MB).'));
    const r = new FileReader();
    r.onload = () => { qrisImage = String(r.result); render(); toast('Gambar siap. Klik Simpan.'); };
    r.readAsDataURL(file);
  }

  async function save(f) {
    const body = {};
    for (const k of ['shop_name', 'shop_tagline', 'shop_address', 'shop_phone', 'open_time', 'close_time', 'receipt_footer', 'qris_name', 'public_url']) body[k] = f[k].value.trim();
    body.table_ordering = f.table_ordering.checked ? '1' : '0';
    body.table_count = Number(f.table_count.value) || 0;
    if (qrisImage !== null) body.qris_image = qrisImage;
    if (!body.shop_name) return fail(new Error('Nama warung wajib diisi.'));
    const btn = $('[data-save]'); btn.disabled = true;
    try {
      // Table names first (only those that changed), then the rest.
      for (const inp of $$('[data-table-name]')) {
        const t = tables.find((x) => x.id === Number(inp.dataset.tableName));
        if (t && inp.value.trim() !== t.name) await api(`/api/admin/tables/${t.id}`, { method: 'PUT', body: { name: inp.value.trim() } });
      }
      ({ settings: s, tables } = await api('/api/admin/settings', { method: 'PUT', body }));
      qrisImage = null;
      render();
      toast('Pengaturan tersimpan');
    } catch (err) { fail(err); btn.disabled = false; }
  }

  load().catch(fail);
})();
