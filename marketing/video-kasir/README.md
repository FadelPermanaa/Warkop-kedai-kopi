# Video Demo — Kasir Warkop (versi Medium)

Video demo 62 detik untuk **pemilik warkop / kedai kopi**. Pesannya satu: *internet putus, kasir tetap jalan.*

Semua layar laptop dan HP di video adalah tampilan asli aplikasi `medium/` yang dijalankan dengan data contoh "Warkop Kita". Saat screenshot diambil, semua akses ke internet diblokir dan tidak ada satu pun permintaan yang keluar, jadi yang terlihat di video memang berjalan offline. Musik dan efek suara dibuat lewat kode, jadi bebas hak cipta.

| File | Ukuran | Untuk |
|---|---|---|
| [output/kasir-warkop-demo-16x9.mp4](output/kasir-warkop-demo-16x9.mp4) | 1920×1080 | YouTube, website, presentasi ke calon pembeli |
| [output/kasir-warkop-demo-9x16.mp4](output/kasir-warkop-demo-9x16.mp4) | 1080×1920 | Instagram Reels, TikTok, YouTube Shorts, Status WA |

Setiap video diberi **watermark Linea.js di pojok** sejak detik pertama (kanan bawah untuk 16:9, kanan atas untuk 9:16) dan ditutup **animasi logo Linea.js** selama 3,6 detik. `build.sh` menambahkannya otomatis lewat [`../brand/`](../brand/README.md).

Versi 9:16 punya panel **"Diperbesar"** di bawah laptop. Panel ini memperbesar bagian layar yang sedang diklik supaya tetap terbaca di HP.

## Alur video

| Detik | Adegan | Isi |
|---|---|---|
| 0–5,5 | Pembuka | Awan internet dicoret, muncul pesan error. *"Internet warung putus? Kasir tetap jalan."* |
| 5,5–10 | Judul | **Kasir Warkop** — sistem kasir offline untuk warkop & kedai kopi |
| 10–14 | Cara kerja | HP pelanggan → Wi-Fi warung → laptop kasir. Internet: tidak wajib |
| 14–21 | Layar kasir | Meja 3, 2× Kopi Susu, Pisang Goreng, Teh Manis, catatan "Gula sedikit" |
| 21–26,8 | Pembayaran | Tunai Rp50.000, kembalian Rp32.000, struk 58 mm keluar |
| 26,8–37 | Pesan dari meja | Rina di Meja 7 pesan dari HP → kasir dapat "ding" → diterima → HP menampilkan "Pesanan diterima" |
| 37–42,6 | Meja & bon | Peta meja terisi, detail bon Meja 5 dengan tombol pindah / gabung / pisah |
| 42,6–46,8 | Stok | Kategori Camilan: Bakwan "Habis", Tahu Isi "Sisa 3" |
| 46,8–51,8 | Tutup kas | Uang di laci dihitung, kurang Rp2.000 langsung terlihat |
| 51,8–56,4 | Laporan | Laporan bulan lalu: pendapatan, menu terlaris, jam ramai |
| 56,4–62 | Ajakan | *"Internet putus? Kasir tetap jalan."* + tombol **Minta demo**, dibuat oleh Linea.js |

## Mengubah teks lalu render ulang

- **Teks penutup dan tombol:** `CONFIG` di bagian atas `<script>` dalam [stage.html](stage.html).
- **Judul tiap adegan:** blok `<div class="copy">` di file yang sama.
- **Waktu klik dan pergantian layar:** [timeline.js](timeline.js). File ini dipakai bersama oleh animasi dan `audio.py`, jadi suara klik ikut bergeser.

```bash
cd marketing/video-kasir
npm install                     # GSAP (+ Playwright)
npx playwright install chromium # sekali saja
npm run build                   # → output/*.mp4  (perlu ffmpeg dan python3)
```

- **Lihat animasinya tanpa render:** buka `stage.html` di browser (tambahkan `?f=v` untuk versi vertikal).
- **Cek satu frame:** `node render.js h 12.5,27` → `preview/h-12.5.jpg`.
- **Kalau `ffmpeg` tidak ada di PATH:** `FFMPEG=/lokasi/ffmpeg npm run build`.

## Mengambil ulang screenshot

```bash
cd marketing/video-kasir
node capture.js      # → shots/*.png + shots/taps.js
```

Skrip ini:
- menyalakan `medium/` di port 3310 dengan database baru dan data contoh;
- menyiapkan beberapa bon terbuka dan stok gorengan;
- menjalankan satu shift di laptop (1366×768) dan HP (390×844);
- memblokir semua akses internet, lalu menulis jumlah permintaan yang diblokir di akhir (harus 0);
- mengatur jam di layar sekitar pukul 19.00 supaya terlihat seperti malam yang ramai.

`shots/taps.js` berisi posisi setiap klik untuk kursor di video.

## Isi folder

| File | Fungsi |
|---|---|
| `stage.html` | Semua adegan dan animasi (GSAP), 1920×1080 atau 1080×1920 |
| `timeline.js` | Waktu klik, pergantian layar dan isyarat suara |
| `render.js` | Merekam `stage.html` frame demi frame (30 fps) dengan Chromium |
| `audio.py` | Membuat musik dan efek suara (Python standar, tanpa library tambahan) |
| `capture.js` | Mengambil screenshot dari aplikasi Kasir Warkop |
| `build.sh` | Audio + render + encode jadi MP4 |
| `shots/` | Screenshot yang dipakai di video |
| `assets/` | Logo Linea.js (penutup video) |
| `fonts/` | Font Poppins |
| `output/` | Video jadi |
