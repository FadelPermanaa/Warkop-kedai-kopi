# Kasir Warkop (Medium)

Aplikasi kasir untuk warkop / kedai kopi. Berjalan di satu komputer (laptop kasir) dan bisa
dibuka dari HP atau tablet lain yang tersambung ke Wi-Fi warung. Tidak perlu internet setelah
terpasang.

## Fitur

**Kasir**
- Layar kasir: ketuk menu, atur jumlah, tambah catatan (mis. "tidak pedas").
- Makan di sini (pilih meja) atau bawa pulang (isi nama).
- Bon terbuka per meja: tambah pesanan kapan saja, bayar di akhir.
- Pindah meja, gabung bon, pisah bon (untuk bayar sendiri-sendiri).
- Bayar tunai (dengan tombol uang pas / 20 rb / 50 rb dan kembalian otomatis), QRIS, atau
  campur QRIS + tunai.
- Diskon per bon (tercatat di riwayat aktivitas).
- Struk 58 mm untuk printer thermal, cetak tagihan sebelum bayar, cetak ulang struk.
- Riwayat transaksi per tanggal dengan pencarian.
- Buka kas dengan modal awal, tutup kas dengan hitungan uang di laci: kelihatan pas, kurang,
  atau lebih.

**Pesan dari meja (QR)**
- Setiap meja punya QR sendiri. Pelanggan memindai, melihat menu, lalu mengirim pesanan.
- Pesanan masuk ke halaman **Pesanan masuk** kasir dengan bunyi "ding".
- Kasir menerima (masuk ke bon meja yang sudah ada atau bon baru) atau menolak dengan alasan.
- Pelanggan melihat status pesanannya langsung di HP: menunggu, diterima, atau ditolak.
- Pemilik bisa mematikan fitur ini kapan saja, dan membuat QR baru kalau QR lama tersebar.

**Stok**
- Stok dihitung per menu, hanya untuk menu yang dipilih (mis. gorengan, Indomie).
- Berkurang otomatis saat dipesan, kembali kalau bon dibatalkan.
- Menu yang habis otomatis tidak bisa dipesan di kasir maupun dari meja.
- Peringatan stok menipis, stok masuk, hitung ulang (opname), barang rusak, dan riwayatnya.

**Laporan (pemilik)**
- Hari ini, kemarin, 7 hari, bulan ini, bulan lalu, atau tanggal bebas.
- Pendapatan, jumlah transaksi, rata-rata per bon, tunai vs QRIS.
- Menu terlaris, per kategori, per kasir, per hari, dan jam paling ramai.
- Riwayat buka/tutup kas dengan selisihnya.
- Unduh transaksi dan penjualan menu sebagai CSV yang langsung terbuka di Excel.
- Riwayat aktivitas: siapa membatalkan bon, memberi diskon, mengubah harga, dsb.

**Pengaturan (pemilik)**
- Menu & harga, kategori, label (Favorit / Baru / Klasik / Pedas), tersedia atau tidak.
- Staf: akun kasir dan pemilik, ganti kata sandi, nonaktifkan akun.
- Nama warung, alamat, nomor HP, tulisan di bawah struk.
- Gambar QRIS warung (ditampilkan ke pelanggan saat bayar QRIS).
- Jumlah dan nama meja, cetak QR semua meja sekaligus.

### Peran

| | Kasir | Pemilik |
|---|:-:|:-:|
| Melayani pesanan, menerima pembayaran, cetak struk | ✅ | ✅ |
| Pindah / gabung / pisah bon, diskon | ✅ | ✅ |
| Terima / tolak pesanan dari meja | ✅ | ✅ |
| Stok masuk | ✅ | ✅ |
| Buka / tutup kas | ✅ | ✅ |
| Membatalkan bon yang berisi item atau sudah dibayar | | ✅ |
| Hitung ulang stok, catat barang rusak | | ✅ |
| Laporan, menu & harga, staf, pengaturan | | ✅ |

## Cara menjalankan

Butuh **Node.js 22.13 atau lebih baru** ([nodejs.org](https://nodejs.org), pilih LTS).

### Windows

Klik dua kali **`JALANKAN.bat`**. Pertama kali, berkas ini memasang komponen (butuh internet)
dan mengisi data contoh 30 hari supaya laporan langsung terisi. Browser terbuka sendiri.

### Mac / Linux

```bash
cd medium
npm install
npm run seed      # opsional: data contoh 30 hari
npm start
```

Buka **http://localhost:3300**.

| Akun | Nama pengguna | Kata sandi |
|---|---|---|
| Pemilik | `pemilik` | `pemilik123` |
| Kasir (dari data contoh) | `kasir` | `kasir123` |

**Ganti kata sandi pemilik** di menu **Staf** sebelum dipakai sungguhan.

Untuk mulai dari kosong (tanpa data contoh), hapus folder `medium/data` lalu jalankan lagi
tanpa `npm run seed`.

### Dipakai di HP / tablet

1. Komputer kasir dan HP tersambung ke Wi-Fi yang sama.
2. Cari alamat IP komputer (Windows: buka `cmd`, ketik `ipconfig`, lihat "IPv4 Address",
   mis. `192.168.1.10`).
3. Buka `http://192.168.1.10:3300` di HP.
4. Di **Pengaturan**, isi *Alamat untuk QR* dengan alamat itu, lalu cetak QR meja. Dengan
   begitu QR yang ditempel di meja mengarah ke komputer kasir.

### Printer struk

Struk dibuat untuk kertas thermal 58 mm. Saat jendela cetak muncul, pilih printer thermal,
ukuran kertas 58 mm, dan margin "None".

## Pengaturan lanjutan

| Variabel | Default | Fungsi |
|---|---|---|
| `PORT` | `3300` | Port aplikasi |
| `DATA_DIR` | `medium/data` | Folder database |
| `TZ` | `Asia/Jakarta` | Zona waktu warung |
| `COOKIE_SECURE` | – | Isi `1` kalau dibuka lewat HTTPS |
| `TRUST_PROXY` | – | Isi kalau berada di belakang reverse proxy |

Database berupa satu berkas SQLite: `data/warkop.db`. **Cadangkan berkas ini** secara rutin
(mis. salin ke flashdisk atau Google Drive saat tutup warung).

## Untuk pengembang

```bash
npm test          # 15 tes: login & peran, bon, pembayaran, stok, pesan dari meja, kas, laporan
npm run dev       # server dengan restart otomatis
```

- `server.js` menyalakan server; `src/app.js` berisi Express, keamanan, dan rute halaman.
- `src/services/` berisi aturan bisnis (bon, stok, kas, laporan, pesan dari meja).
- `src/routes/` berisi API: `auth`, `staff`, `orders`, `admin` (pemilik), `public` (pelanggan).
- `public/` berisi halaman HTML + JavaScript biasa (tanpa build step).
- Database memakai SQLite bawaan Node (`node:sqlite`) dengan migrasi lewat `PRAGMA user_version`.

Keamanan: kata sandi di-hash dengan scrypt, sesi di cookie HttpOnly, perubahan data hanya
menerima JSON dari situs sendiri (melindungi dari CSRF), Content-Security-Policy ketat, batas
percobaan login, dan sel CSV yang diawali `=`, `+`, `-`, `@` diamankan supaya tidak dijalankan
sebagai rumus di Excel.

---

Dibuat oleh **Linea.js**.
