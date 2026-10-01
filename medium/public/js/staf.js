'use strict';
(async () => {
  const { $, $$, esc, api, toast, fail, modal } = App;
  const me = await App.boot('staf', { owner: true });
  const main = $('#main');
  let users = [];
  async function load() { ({ users } = await api('/api/admin/users')); render(); }
  function render() {
    main.innerHTML = `
      <div class="page-head"><div><h1>Staf</h1><p>Kasir bisa melayani &amp; menerima pembayaran. Pemilik bisa semuanya, termasuk membatalkan transaksi dan melihat laporan.</p></div>
        <button class="btn" data-add>+ Tambah staf</button></div>
      <div class="card"><div class="table-wrap"><table class="data stack">
        <thead><tr><th>Nama</th><th>Nama pengguna</th><th>Peran</th><th>Status</th><th></th></tr></thead>
        <tbody>${users.map((u) => `<tr>
          <td data-label="Nama"><b>${esc(u.name)}</b>${u.id === me.id ? ' <span class="chip">Anda</span>' : ''}</td>
          <td data-label="Pengguna">${esc(u.username)}</td>
          <td data-label="Peran"><span class="chip ${u.role === 'pemilik' ? '' : 'grey'}">${u.role === 'pemilik' ? 'Pemilik' : 'Kasir'}</span></td>
          <td data-label="Status">${u.active ? '<span class="chip ok">Aktif</span>' : '<span class="chip grey">Nonaktif</span>'}</td>
          <td class="num"><button class="btn ghost sm" data-edit="${u.id}">Ubah</button></td></tr>`).join('')}</tbody>
      </table></div></div>`;
    $('[data-add]').addEventListener('click', () => edit(null));
    $$('[data-edit]').forEach((b) => b.addEventListener('click', () => edit(users.find((u) => u.id === Number(b.dataset.edit)))));
  }
  function edit(u) {
    const isNew = !u;
    const m = modal(`
      <h2>${isNew ? 'Tambah staf' : 'Ubah ' + esc(u.name)}</h2>
      <form class="grid" data-form>
        <label class="field"><span>Nama</span><input name="name" value="${esc(u?.name || '')}" maxlength="60" required></label>
        ${isNew ? '<label class="field"><span>Nama pengguna (untuk masuk)</span><input name="username" autocapitalize="none" maxlength="30" required></label>' : ''}
        <label class="field"><span>Peran</span><select name="role"><option value="kasir">Kasir</option><option value="pemilik" ${u?.role === 'pemilik' ? 'selected' : ''}>Pemilik</option></select></label>
        <label class="field"><span>${isNew ? 'Kata sandi' : 'Kata sandi baru (kosongkan kalau tidak diganti)'}</span><input name="password" type="password" autocomplete="new-password" minlength="6"></label>
        ${isNew ? '' : `<label class="check"><input type="checkbox" name="active" ${u.active ? 'checked' : ''}> Akun aktif</label>`}
      </form>
      <div class="foot"><button class="btn ghost" data-close>Batal</button><button class="btn" data-save>Simpan</button></div>`);
    const f = m.querySelector('[data-form]');
    const save = async () => {
      const body = { name: f.name.value, role: f.role.value };
      if (f.password.value) body.password = f.password.value;
      if (isNew) body.username = f.username.value; else body.active = f.active.checked;
      try { await api(isNew ? '/api/admin/users' : `/api/admin/users/${u.id}`, { method: isNew ? 'POST' : 'PUT', body }); m.close(); toast('Tersimpan'); load(); } catch (e) { fail(e); }
    };
    m.querySelector('[data-save]').addEventListener('click', save);
    f.addEventListener('submit', (e) => { e.preventDefault(); save(); });
  }
  load().catch(fail);
})();
