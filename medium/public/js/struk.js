/* Receipt for 58 mm thermal printers (also fine on A4). No watermark here on purpose. */
'use strict';
(async () => {
  const { $, esc, api } = App;
  const params = new URLSearchParams(location.search);
  const rp = (n) => Math.round(Number(n) || 0).toLocaleString('id-ID');
  const METHOD = { tunai: 'Tunai', qris: 'QRIS' };
  const el = $('#struk');
  try {
    const me = await api('/api/me');
    if (!me.user) { location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search); return; }
    const [{ order: o }, shop] = await Promise.all([api('/api/orders/' + Number(params.get('id'))), api('/api/shop')]);
    const when = o.paid_at || o.opened_at;
    el.innerHTML = `
      <header>
        <b class="shop">${esc(shop.name)}</b>
        ${shop.address ? `<div>${esc(shop.address)}</div>` : ''}
        ${shop.phone ? `<div>${esc(shop.phone)}</div>` : ''}
      </header>
      <div class="rule"></div>
      <div class="kv"><span>No.</span><span>${esc(o.code)}</span></div>
      <div class="kv"><span>Tanggal</span><span>${esc(when.slice(8, 10) + '/' + when.slice(5, 7) + '/' + when.slice(0, 4) + ' ' + when.slice(11, 16))}</span></div>
      <div class="kv"><span>${o.type === 'take_away' ? 'Jenis' : 'Meja'}</span><span>${o.type === 'take_away' ? 'Bawa pulang' : esc(o.table_name || '-')}</span></div>
      ${o.customer_name ? `<div class="kv"><span>Nama</span><span>${esc(o.customer_name)}</span></div>` : ''}
      ${o.paid_by_name || o.opened_by_name ? `<div class="kv"><span>Kasir</span><span>${esc(o.paid_by_name || o.opened_by_name)}</span></div>` : ''}
      <div class="rule"></div>
      ${o.items.map((it) => `
        <div class="item">${esc(it.name)}</div>
        ${it.note ? `<div class="item-note">(${esc(it.note)})</div>` : ''}
        <div class="kv"><span>${it.qty} x ${rp(it.price)}</span><span>${rp(it.qty * it.price)}</span></div>`).join('')}
      <div class="rule"></div>
      <div class="kv"><span>Subtotal</span><span>${rp(o.subtotal)}</span></div>
      ${o.discount ? `<div class="kv"><span>Diskon</span><span>-${rp(o.discount)}</span></div>` : ''}
      <div class="kv total"><span>TOTAL</span><span>${rp(o.total)}</span></div>
      ${o.payments.map((p) => `<div class="kv"><span>${METHOD[p.method]}</span><span>${rp(p.method === 'tunai' ? p.received : p.amount)}</span></div>
        ${p.method === 'tunai' && p.change ? `<div class="kv"><span>Kembali</span><span>${rp(p.change)}</span></div>` : ''}`).join('')}
      <div class="rule"></div>
      ${o.status === 'open' ? '<div class="stamp">TAGIHAN — BELUM DIBAYAR</div>' : ''}
      ${o.status === 'void' ? '<div class="stamp">DIBATALKAN</div>' : ''}
      ${o.status === 'paid' && params.get('copy') ? '<div class="stamp">SALINAN</div>' : ''}
      <footer>${esc(shop.footer || '')}</footer>`;
    document.title = 'Struk ' + o.code;
    $('[data-print]').addEventListener('click', () => window.print());
    $('[data-close]').addEventListener('click', () => window.close());
    if (params.get('print') === '1') setTimeout(() => window.print(), 300);
  } catch (e) {
    el.innerHTML = `<p>${esc(e.message)}</p>`;
  }
})();
