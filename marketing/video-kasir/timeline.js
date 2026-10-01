// Shared by stage.html (animation) and audio.py (sound cues). Times in seconds.
// laptop / phone: [time, screenshot to show (or null), click/tap target from shots/taps.js (or null)]
// A click lands at `time`; the new screenshot appears just after it.
window.TIMELINE = {
  "duration": 62,
  "laptop": [
    [15.0, "l01-kasir", null],
    [15.9, "l02-meja", "table"],
    [16.6, "l03-tambah", "add3"],
    [17.2, "l04-tambah", "add4"],
    [17.8, "l05-tambah", "add5"],
    [18.4, "l06-tambah", "add6"],
    [19.2, "l07-catatan", "note"],
    [19.8, null, "chip"],
    [20.4, "l08-bon", "noteOk"],
    [21.3, "l09-bayar", "pay"],
    [22.3, "l10-uang", "cash"],
    [23.2, "l11-lunas", "confirm"],
    [31.4, "l12-masuk", null],
    [32.7, "l13-diterima", "accept"],
    [37.6, "l14-meja", null],
    [39.2, "l15-detail", "bill5"],
    [42.9, "l01-kasir", null],
    [43.9, "l16-habis", "camilan"],
    [47.0, "l17-riwayat", null],
    [48.4, "l18-tutup", "closeKas"],
    [52.0, "l19-laporan", null],
    [54.1, "l20-jam", null]
  ],
  "phone": [
    [27.7, "p01-menu", null],
    [28.6, "p02-tambah", "pAdd1"],
    [29.2, "p03-tambah", "pAdd2"],
    [29.9, "p04-keranjang", "pBar"],
    [30.8, "p05-menunggu", "pSend"],
    [33.5, "p06-diterima", null]
  ],
  "ding": [31.5, 33.5],
  "printer": 23.9,
  "whoosh": [5.3, 9.8, 13.8, 26.6, 37.0, 42.5, 46.7, 51.7, 56.3],
  "scenes": { "hook": 0, "title": 5.5, "how": 10, "kasir": 14, "bayar": 21, "qr": 26.8, "meja": 37.2, "stok": 42.6, "kas": 46.8, "laporan": 51.8, "cta": 56.4 }
};
