# Video Promosi — Menu Digital Warkop (versi Basic)

Video promosi 30 detik untuk **pemilik warkop / kedai kopi**. Semua layar HP di video adalah tampilan asli website versi Basic (`basic/`) dengan data contoh **"Warkop Kita"**, lalu dianimasikan. Musik dan efek suara dibuat lewat kode, jadi bebas hak cipta.

| File | Ukuran | Untuk |
|---|---|---|
| [output/warkop-promo-16x9.mp4](output/warkop-promo-16x9.mp4) | 1920×1080 | YouTube, website, presentasi |
| [output/warkop-promo-9x16.mp4](output/warkop-promo-9x16.mp4) | 1080×1920 | Instagram Reels, TikTok, YouTube Shorts, Status WA |

## Alur video

| Detik | Adegan | Isi |
|---|---|---|
| 0–4,6 | Masalah | Teriakan pesanan dan menu kertas lusuh. *"Teriak pesan dari pojok. Menu kertas lusuh. Pesanan salah catat?"* |
| 4,6–8,6 | Solusi | Layar disapu kuning, judul **Menu Digital Warkop** |
| 8,6–14 | Scan & pilih | QR di meja 4 dipindai, halaman depan, lalu 2× Es Kopi Susu Gula Aren dan Indomie Goreng Telur masuk keranjang |
| 14–19,4 | Kirim lewat WhatsApp | Keranjang (meja 4 terisi otomatis), nama dan catatan diisi, pesan WA rapi muncul |
| 19,4–24,6 | Untuk pemilik | Harga diubah di `js/menu.js` (15000 → 16000) dan menu di HP ikut berubah |
| 24,6–30 | Ajakan (CTA) | Cangkir kopi beruap, kartu *"Ngopi makin santai, pesanan makin rapi."* dan tombol **Minta Demo Gratis** |

Isi pesan WhatsApp di video adalah teks asli yang dibuat website saat tombol "Kirim Pesanan via WhatsApp" ditekan. QR di kartu meja hanya hiasan, bukan kode yang bisa dipindai.

## Mengubah teks lalu render ulang

Teks utama ada di `CONFIG` di bagian atas `<script>` dalam [stage.html](stage.html). Teks pembuka, judul tiap adegan, potongan kode, dan teks WA (`WA_TEXT`) juga ada di file itu.

```bash
cd marketing/video
npm install                     # GSAP + Playwright
npx playwright install chromium # sekali saja
npm run build                   # → output/*.mp4  (perlu ffmpeg dan python3)
```

- **Lihat animasinya tanpa render:** buka `stage.html` di browser (tambahkan `?f=v` untuk versi vertikal).
- **Cek satu frame:** `node render.js h 12.5,27` → `preview/h-12.5.jpg`.
- Kalau `ffmpeg` tidak ada di PATH: `FFMPEG=/lokasi/ffmpeg npm run build`.

## Mengambil ulang screenshot

```bash
cd basic && python3 -m http.server 3400              # server statis apa saja
# terminal lain, di folder ini:
BASE_URL=http://localhost:3400 node capture.js        # → shots/*.png + shots/taps.json
```

Ambil di jam buka warkop (lihat `hours` di `basic/js/config.js`) supaya tanda "Buka sekarang" yang tampil. `shots/taps.json` berisi posisi ketukan dan teks WA. Kalau berubah, salin ke `TAPS` dan `WA_TEXT` di `stage.html`.

## Isi folder

| File | Fungsi |
|---|---|
| `stage.html` | Semua adegan dan animasi (GSAP), ukuran 1920×1080 atau 1080×1920 |
| `render.js` | Merekam `stage.html` frame demi frame (30 fps) dengan Chromium |
| `audio.py` | Membuat musik dan efek suara (Python standar, tanpa library tambahan) |
| `capture.js` | Mengambil screenshot dari website |
| `build.sh` | Audio + render + encode jadi MP4 |
| `shots/` | Screenshot yang dipakai di video |
| `fonts/` | Font Poppins (dipakai website dan video) |
| `output/` | Video jadi |
