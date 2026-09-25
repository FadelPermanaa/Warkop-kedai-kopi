(function () {
  "use strict";

  const CONFIG = window.WARKOP_CONFIG;
  const MENU = window.WARKOP_MENU;
  const CART_KEY = "warkop-cart";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const rupiah = (n) => "Rp" + n.toLocaleString("id-ID");
  const itemById = new Map(MENU.items.map((item) => [item.id, item]));
  const isAvailable = (item) => item.available !== false;

  // Simple line icons, one per category.
  const ICONS = {
    kopi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3c0 1 1 1 1 2s-1 1-1 2M12 3c0 1 1 1 1 2s-1 1-1 2"/><path d="M3 21h16"/></svg>',
    "non-kopi": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1.5 13a1 1 0 0 1-1 .9h-7a1 1 0 0 1-1-.9L6 7Z"/><path d="M5 7h14"/><path d="M13 7l2-5"/><path d="M7 12h10"/></svg>',
    makanan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18a9 9 0 0 1-18 0Z"/><path d="M8 8c0-1.5 1-2 1-3.5M12 8c0-1.5 1-2 1-3.5M16 8c0-1.5 1-2 1-3.5"/></svg>',
    camilan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15c2-6 7-10 13-10 1.5 0 3 .5 3 2 0 6-6 12-13 12-2 0-3.5-1.5-3-4Z"/><path d="M9 14c1-2 3-4 6-5"/></svg>',
  };

  // ---------- Storage (optional; page works without it) ----------
  function loadCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
      const cart = {};
      for (const [id, qty] of Object.entries(raw)) {
        const item = itemById.get(id);
        if (item && isAvailable(item) && Number.isInteger(qty) && qty > 0) cart[id] = qty;
      }
      return cart;
    } catch {
      return {};
    }
  }
  function saveCart() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    } catch {
      /* storage unavailable — ignore */
    }
  }

  const state = {
    category: "semua",
    query: "",
    cart: loadCart(),
  };

  // ---------- Store info ----------
  function toMinutes(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  function isOpenNow(date = new Date()) {
    const now = date.getHours() * 60 + date.getMinutes();
    const open = toMinutes(CONFIG.hours.open);
    const close = toMinutes(CONFIG.hours.close);
    if (open === close) return true; // 24 hours
    return open < close ? now >= open && now < close : now >= open || now < close; // overnight
  }

  const hoursRange = () => `${CONFIG.hours.open.replace(":", ".")}–${CONFIG.hours.close.replace(":", ".")}`;

  function renderStatus() {
    const pill = $("[data-status]");
    const open = isOpenNow();
    pill.classList.toggle("is-open", open);
    pill.classList.toggle("is-closed", !open);
    $("[data-status-text]").textContent = `${open ? "Buka sekarang" : "Sedang tutup"} · ${hoursRange()}`;
  }

  function renderStoreInfo() {
    $$("[data-store-name]").forEach((el) => (el.textContent = CONFIG.name));
    document.title = `${CONFIG.name} — Menu & Pesan`;
    renderStatus();

    $("[data-address]").textContent = CONFIG.address;
    $("[data-hours]").textContent = `Setiap hari, ${hoursRange()}`;

    const waLink = $("[data-wa-link]");
    waLink.href = `https://wa.me/${CONFIG.whatsapp}`;
    waLink.textContent = "+" + CONFIG.whatsapp;

    const mapsQ = encodeURIComponent(CONFIG.mapsQuery);
    $("[data-maps-link]").href = `https://www.google.com/maps/search/?api=1&query=${mapsQ}`;
    $("[data-map]").src = `https://maps.google.com/maps?q=${mapsQ}&z=16&output=embed`;

    const ig = $("[data-ig-link]");
    ig.href = `https://instagram.com/${CONFIG.instagram}`;
    ig.textContent = "@" + CONFIG.instagram;

    $("[data-year]").textContent = new Date().getFullYear();
    $("[data-stat-items]").textContent = MENU.items.length + "+";
  }

  // ---------- Menu ----------
  function renderTabs() {
    const tabs = [{ id: "semua", label: "Semua" }, ...MENU.categories];
    const wrap = $("[data-tabs]");
    wrap.innerHTML = "";
    for (const tab of tabs) {
      const btn = document.createElement("button");
      btn.className = "tab";
      btn.type = "button";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(tab.id === state.category));
      btn.textContent = tab.label;
      btn.addEventListener("click", () => {
        state.category = tab.id;
        renderTabs();
        renderMenu();
      });
      wrap.appendChild(btn);
    }
  }

  function stepperHTML(id, qty, disabled) {
    if (disabled) return '<button type="button" disabled aria-label="Habis">+</button>';
    if (!qty) return `<button type="button" data-add="${id}" aria-label="Tambah">+</button>`;
    return `
      <button type="button" class="minus" data-remove="${id}" aria-label="Kurangi">−</button>
      <span>${qty}</span>
      <button type="button" data-add="${id}" aria-label="Tambah">+</button>`;
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function renderMenu() {
    const q = state.query.trim().toLowerCase();
    const items = MENU.items.filter(
      (item) =>
        (state.category === "semua" || item.category === state.category) &&
        (!q || item.name.toLowerCase().includes(q) || (item.desc || "").toLowerCase().includes(q))
    );

    const grid = $("[data-menu-grid]");
    grid.innerHTML = items
      .map((item) => {
        const soldOut = !isAvailable(item);
        const tags = (item.tags || []).map((t) => `<span class="chip chip--${t === "Favorit" ? "amber" : "blue"}">${escapeHTML(t)}</span>`);
        if (soldOut) tags.unshift('<span class="chip chip--muted">Habis</span>');
        return `
          <article class="card${soldOut ? " is-soldout" : ""}">
            <div class="card__icon">${ICONS[item.category] || ICONS.kopi}</div>
            <div class="card__tags">${tags.join("")}</div>
            <h3>${escapeHTML(item.name)}</h3>
            <p>${escapeHTML(item.desc || "")}</p>
            <div class="card__foot">
              <span class="price">${rupiah(item.price)}</span>
              <div class="stepper">${stepperHTML(item.id, state.cart[item.id], soldOut)}</div>
            </div>
          </article>`;
      })
      .join("");

    $("[data-menu-empty]").hidden = items.length > 0;
  }

  // ---------- Cart ----------
  function cartEntries() {
    return Object.entries(state.cart)
      .map(([id, qty]) => ({ item: itemById.get(id), qty }))
      .filter((e) => e.item);
  }
  const cartCount = () => cartEntries().reduce((sum, e) => sum + e.qty, 0);
  const cartTotal = () => cartEntries().reduce((sum, e) => sum + e.qty * e.item.price, 0);

  function changeQty(id, delta) {
    const item = itemById.get(id);
    if (!item || !isAvailable(item)) return;
    const next = (state.cart[id] || 0) + delta;
    if (next <= 0) delete state.cart[id];
    else state.cart[id] = Math.min(next, 99);
    saveCart();
    renderMenu();
    renderCart();
    if (delta > 0) toast(`${item.name} ditambahkan`);
  }

  function renderCart() {
    const entries = cartEntries();
    const count = cartCount();
    const total = rupiah(cartTotal());

    $$("[data-cart-count]").forEach((el) => (el.textContent = count));
    $$("[data-cart-total]").forEach((el) => (el.textContent = total));
    $("[data-cart-bar]").hidden = count === 0;

    $("[data-cart-list]").innerHTML = entries
      .map(
        ({ item, qty }) => `
        <li class="cart-item">
          <div>
            <div class="cart-item__name">${escapeHTML(item.name)}</div>
            <div class="cart-item__price">${rupiah(item.price)} × ${qty} = <b>${rupiah(item.price * qty)}</b></div>
          </div>
          <div class="stepper">${stepperHTML(item.id, qty, false)}</div>
        </li>`
      )
      .join("");

    $("[data-cart-empty]").hidden = entries.length > 0;
    $("[data-order-form]").hidden = entries.length === 0;
    $("[data-checkout]").disabled = entries.length === 0;
    $("[data-clear-cart]").hidden = entries.length === 0;
  }

  // ---------- Drawer ----------
  let lastFocus = null;
  function openCart() {
    lastFocus = document.activeElement;
    $("[data-overlay]").hidden = false;
    const drawer = $("[data-drawer]");
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    $("[data-close-cart]").focus();
  }
  function closeCart() {
    $("[data-overlay]").hidden = true;
    const drawer = $("[data-drawer]");
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }

  // ---------- Checkout ----------
  function buildMessage({ type, name, table, note }) {
    const lines = [`Halo ${CONFIG.name}, saya mau pesan:`, ""];
    lines.push(`Nama: ${name}`);
    lines.push(`Tipe: ${type}`);
    if (table) lines.push(`Meja: ${table}`);
    lines.push("");
    cartEntries().forEach(({ item, qty }, i) => {
      lines.push(`${i + 1}. ${qty}x ${item.name} — ${rupiah(item.price * qty)}`);
    });
    lines.push("");
    lines.push(`Total: ${rupiah(cartTotal())}`);
    if (note) lines.push(`Catatan: ${note}`);
    lines.push("", "Terima kasih!");
    return lines.join("\n");
  }

  function checkout() {
    const form = $("[data-order-form]");
    const data = Object.fromEntries(new FormData(form));
    const errorEl = $("[data-form-error]");
    const nameInput = form.elements.name;
    const tableInput = form.elements.table;
    const dineIn = data.type === "Makan di tempat";

    nameInput.classList.remove("is-invalid");
    tableInput.classList.remove("is-invalid");

    let error = "";
    if (!data.name.trim()) {
      error = "Isi nama kamu dulu ya.";
      nameInput.classList.add("is-invalid");
    } else if (dineIn && !data.table.trim()) {
      error = "Isi nomor meja untuk makan di tempat.";
      tableInput.classList.add("is-invalid");
    }
    errorEl.textContent = error;
    errorEl.hidden = !error;
    if (error) return;

    const message = buildMessage({
      type: data.type,
      name: data.name.trim(),
      table: dineIn ? data.table.trim() : "",
      note: data.note.trim(),
    });
    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }

  // ---------- Toast ----------
  let toastTimer;
  function toast(text) {
    const el = $("[data-toast]");
    el.textContent = text;
    el.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-show"), 1600);
  }

  // ---------- Events ----------
  function bindEvents() {
    document.addEventListener("click", (e) => {
      const add = e.target.closest("[data-add]");
      const remove = e.target.closest("[data-remove]");
      if (add) changeQty(add.dataset.add, 1);
      else if (remove) changeQty(remove.dataset.remove, -1);
    });

    $$("[data-open-cart]").forEach((btn) => btn.addEventListener("click", openCart));
    $("[data-close-cart]").addEventListener("click", closeCart);
    $("[data-overlay]").addEventListener("click", closeCart);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && $("[data-drawer]").classList.contains("is-open")) closeCart();
    });

    $("[data-search]").addEventListener("input", (e) => {
      state.query = e.target.value;
      renderMenu();
    });

    // Hide the table field for take-away orders.
    $$('input[name="type"]').forEach((radio) =>
      radio.addEventListener("change", () => {
        $("[data-table-field]").hidden = radio.value !== "Makan di tempat";
      })
    );

    $$("[data-order-form] input").forEach((input) =>
      input.addEventListener("input", () => {
        input.classList.remove("is-invalid");
        $("[data-form-error]").hidden = true;
      })
    );

    $("[data-checkout]").addEventListener("click", checkout);
    $("[data-clear-cart]").addEventListener("click", () => {
      state.cart = {};
      saveCart();
      renderMenu();
      renderCart();
    });
  }

  // Prefill table number from a QR link like index.html?meja=4
  function prefillTable() {
    const meja = new URLSearchParams(location.search).get("meja");
    if (meja) $("[data-order-form]").elements.table.value = meja.slice(0, 10);
  }

  renderStoreInfo();
  renderTabs();
  renderMenu();
  renderCart();
  prefillTable();
  bindEvents();
  setInterval(renderStatus, 60 * 1000);
})();
