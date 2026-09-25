# Warkop Kedai Kopi

Kumpulan sistem digital untuk warkop / kedai kopi Indonesia, dibangun bertahap dari yang
paling sederhana sampai platform lengkap. Semua versi ada di satu repository ini.

| Versi | Folder | Jenis | Dipakai oleh | Status |
|---|---|---|---|---|
| **Basic** — Menu Digital & Pesan via WhatsApp | [`basic/`](basic/README.md) | Website statis | Pelanggan | ✅ Selesai |
| **Medium** — Kasir Warkop (POS) | `medium/` | Web app + database | Kasir & pemilik | 🔜 Rencana |
| **Complex** — Warkop Hub (multi-cabang) | `complex/` | Aplikasi + platform | Pelanggan, staf, kantor pusat | 🔜 Rencana |

---

## Basic — Menu Digital & Pesan via WhatsApp

Pelanggan scan QR di meja → lihat menu → masukkan ke keranjang → pesanan terkirim ke
WhatsApp kasir. Tanpa server, tanpa install, hosting gratis.

📄 Dokumentasi lengkap: **[basic/README.md](basic/README.md)**

## Medium — Kasir Warkop (POS)

Web app untuk kasir dan pemilik: login per peran, catat transaksi, bon terbuka per meja,
tunai / QRIS, laporan harian, stok sederhana dan halaman admin menu.

## Complex — Warkop Hub

Platform untuk brand dengan banyak cabang: aplikasi pelanggan, pembayaran online, poin &
promo, layar barista real-time, POS per cabang, manajemen stok berbasis resep, dashboard
pusat dan integrasi GoFood / GrabFood / ShopeeFood.

---

## Desain bersama

Semua versi memakai palet dan font yang sama.

| Warna | Hex |
|---|---|
| Persian Blue | `#013FD0` |
| Amber Flame | `#FFB423` |
| Azure Mist | `#F0FAFB` |

Font: Poppins.
