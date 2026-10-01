'use strict';
(async () => {
  const { $, api } = App;
  App.watermark();
  const { user, shop } = await api('/api/me');
  const next = new URLSearchParams(location.search).get('next');
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/kasir';
  if (user) { location.href = target; return; }
  $('[data-shop]').textContent = shop.name;
  $('#form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      await api('/api/login', { method: 'POST', body: { username: f.get('username'), password: f.get('password') } });
      location.href = target;
    } catch (err) {
      $('#err').textContent = err.message; $('#err').hidden = false; btn.disabled = false;
    }
  });
})();
