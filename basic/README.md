# Warkop Kita — Versi Basic: Menu Digital & Pesan via WhatsApp

> Tahap 1 dari 3 · [← Kembali ke ringkasan proyek](../README.md)

Website menu digital untuk warkop / kedai kopi. Pelanggan scan QR di meja, lihat menu,
masukkan ke keranjang, lalu pesanan terkirim ke WhatsApp kasir dalam format rapi.

**Jenis:** website (web app statis) · **Pengguna:** pelanggan · **Backend:** tidak ada ·
**Biaya hosting:** gratis

---

## Ini sebenarnya apa?

**Website** — **bukan** aplikasi yang diunduh dari Play Store / App Store, dan **bukan**
sistem kasir (POS) offline.

| | Versi Basic (ini) | Aplikasi mobile | Sistem POS / kasir |
|---|---|---|---|
| Dibuka lewat | Browser HP (scan QR / link) | Install dari Play Store | Komputer / tablet kasir |
| Dipakai oleh | **Pelanggan** | Pelanggan | **Kasir / pemilik** |
| Perlu install | Tidak | Ya | Ya / login |
| Perlu server & database | Tidak | Ya | Ya (atau lokal) |
| Mencatat penjualan & laporan | Tidak | Tergantung | Ya |
| Biaya hosting | Gratis | Mahal | Sedang |

Singkatnya: versi ini adalah **"etalase + form pesan"** untuk pelanggan. Pencatatan uang,
stok dan laporan harian ada di versi Medium (POS).

---

## Use case

### Siapa yang pakai

- **Pelanggan** — melihat menu dan memesan dari HP sendiri.
- **Pemilik / kasir** — menerima pesanan di WhatsApp, lalu membuat dan mengantar pesanan.

### Masalah yang diselesaikan

- Pelanggan harus antre / memanggil pelayan hanya untuk pesan.
- Menu kertas cepat lusuh dan susah diganti harganya.
- Pesanan lisan sering salah catat ("gula sedikit" terlupa, meja tertukar).
- Warkop kecil tidak punya budget untuk aplikasi atau mesin kasir.

### Skenario 1 — Makan di tempat (utama)

1. Pelanggan duduk di **meja 4**, scan QR yang tertempel di meja.
2. Browser membuka `https://situs-warkop/?meja=4` → nomor meja terisi otomatis.
3. Pelanggan pilih 2× Es Kopi Susu Gula Aren + 1× Indomie Goreng Telur.
4. Isi nama dan catatan "gula sedikit", tekan **Kirim Pesanan via WhatsApp**.
5. WhatsApp terbuka dengan pesan siap kirim:
   ```
   Halo Warkop Kita, saya mau pesan:

   Nama: Budi
   Tipe: Makan di tempat
   Meja: 4

   1. 2x Es Kopi Susu Gula Aren — Rp30.000
   2. 1x Indomie Goreng Telur — Rp12.000

   Total: Rp42.000
   Catatan: gula sedikit
   ```
6. Kasir menerima chat, membuat pesanan, mengantar ke meja 4, pelanggan bayar di kasir
   (tunai / QRIS).

### Skenario 2 — Bawa pulang / pesan dari rumah

Link website dibagikan di Instagram, Google Maps atau status WhatsApp. Pelanggan pilih
**Bawa pulang**, pesan dari rumah, lalu tinggal ambil ketika sudah siap.

### Skenario 3 — Promosi online

Website sekaligus jadi "profil" warkop: jam buka (status buka/tutup otomatis), alamat,
peta dan menu lengkap dengan harga.

---

## Butuh internet atau tidak?

- **Pelanggan**: butuh internet (kuota / WiFi warkop) untuk membuka website dan mengirim WhatsApp.
- **Pemilik**: cukup WhatsApp di HP seperti biasa. Tidak perlu komputer, server atau aplikasi tambahan.

---

## Fitur

- Menu per kategori (Kopi, Non-Kopi, Makanan, Camilan) + pencarian
- Label **Favorit** / **Baru** dan status **Habis**
- Keranjang dengan tombol +/−, tersimpan di browser walau halaman di-refresh
- Pilihan makan di tempat / bawa pulang, nama, nomor meja, catatan
- Nomor meja otomatis dari QR (`?meja=4`)
- Status buka / tutup otomatis sesuai jam operasional
- Alamat, jam buka dan Google Maps
- Tampilan responsif: di HP keranjang muncul dari bawah + tombol keranjang melayang

---

## Cara pakai untuk pemilik warkop

1. **Ubah data warkop** di `js/config.js`: nama, nomor WhatsApp (format `62812...`),
   alamat, jam buka, Instagram.
2. **Ubah menu** di `js/menu.js`: nama, deskripsi, harga, kategori. Tulis
   `available: false` untuk menandai menu habis.
3. **Online-kan** website (gratis): GitHub Pages, Netlify atau Vercel — unggah isi folder `basic/`.
4. **Buat QR per meja** (generator QR gratis mana saja) berisi link
   `https://situs-kamu/?meja=1`, `?meja=2`, dst. Cetak dan tempel di meja.
5. Selesai — pesanan akan masuk ke WhatsApp.

### Mencoba di komputer sendiri

Buka `basic/index.html` langsung di browser — tanpa install apa pun.

### Contoh isi `js/config.js`

```js
window.WARKOP_CONFIG = {
  name: "Warkop Kita",
  whatsapp: "6281234567890",        // nomor WA kasir, awali 62
  address: "Jl. Merdeka No. 17, Bandung",
  mapsQuery: "Jl. Merdeka No. 17, Bandung",
  hours: { open: "06:00", close: "23:00" },
  instagram: "warkopkita",
};
```

### Contoh menambah menu di `js/menu.js`

```js
{ id: "kopi-pandan", category: "kopi", name: "Es Kopi Pandan", desc: "Kopi susu dengan sirup pandan.", price: 16000, tags: ["Baru"] },
```

---

## Keterbatasan

- Tidak ada pencatatan penjualan, laporan harian atau stok.
- Tidak ada pembayaran online; bayar tetap di kasir.
- Pesanan hanya "terkirim" jika pelanggan menekan kirim di WhatsApp.
- Mengubah menu berarti mengedit file lalu upload ulang (belum ada halaman admin).

Semua keterbatasan di atas diselesaikan di **versi Medium (Kasir Warkop / POS)**.

---

## Desain

| Warna | Hex | Dipakai untuk |
|---|---|---|
| Persian Blue | `#013FD0` | Tombol utama, aksen judul, strip statistik & banner CTA |
| Amber Flame | `#FFB423` | Highlight, badge, label "Favorit", tombol sekunder |
| Azure Mist | `#F0FAFB` | Latar section yang lembut |

Font: Poppins. Tata letak bergaya landing page SaaS modern: hero besar, pill status,
strip statistik, grid kartu menu, langkah bernomor dan banner CTA.

---

## Struktur file

```
basic/
├── index.html      Struktur halaman
├── css/style.css   Tampilan & token warna
└── js/
    ├── config.js   Data warkop (nama, WA, alamat, jam buka)
    ├── menu.js     Data menu
    └── app.js      Logika menu, keranjang, kirim pesanan
```

Teknologi: HTML, CSS, JavaScript murni — tanpa framework, tanpa build, tanpa backend.
