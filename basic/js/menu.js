// Menu data — add, edit or remove items here.
// Set `available: false` to mark an item as "Habis" (sold out).
window.WARKOP_MENU = {
  categories: [
    { id: "kopi", label: "Kopi" },
    { id: "non-kopi", label: "Non-Kopi" },
    { id: "makanan", label: "Makanan" },
    { id: "camilan", label: "Camilan" },
  ],
  items: [
    { id: "kopi-tubruk", category: "kopi", name: "Kopi Tubruk", desc: "Kopi hitam kental khas warkop, ampas di bawah.", price: 5000, tags: ["Klasik"] },
    { id: "kopi-susu", category: "kopi", name: "Kopi Susu", desc: "Kopi hitam dengan susu kental manis.", price: 6000 },
    { id: "es-kopi-gula-aren", category: "kopi", name: "Es Kopi Susu Gula Aren", desc: "Espresso, susu segar dan gula aren cair.", price: 15000, tags: ["Favorit"] },
    { id: "sanger", category: "kopi", name: "Sanger Aceh", desc: "Kopi saring Aceh dengan sedikit susu.", price: 8000 },
    { id: "kopi-jahe", category: "kopi", name: "Kopi Jahe", desc: "Kopi hitam dengan jahe hangat.", price: 7000 },
    { id: "v60", category: "kopi", name: "Manual Brew V60", desc: "Biji kopi Nusantara pilihan, diseduh manual.", price: 18000, tags: ["Baru"] },

    { id: "teh-manis", category: "non-kopi", name: "Teh Manis", desc: "Panas atau dingin.", price: 4000 },
    { id: "teh-tarik", category: "non-kopi", name: "Teh Tarik", desc: "Teh susu yang ditarik sampai berbusa.", price: 8000 },
    { id: "susu-jahe", category: "non-kopi", name: "Susu Jahe", desc: "Susu hangat dengan jahe merah.", price: 8000 },
    { id: "es-jeruk", category: "non-kopi", name: "Es Jeruk", desc: "Jeruk peras segar.", price: 7000 },
    { id: "cokelat", category: "non-kopi", name: "Cokelat", desc: "Cokelat panas atau dingin.", price: 10000, available: false },

    { id: "indomie-goreng", category: "makanan", name: "Indomie Goreng Telur", desc: "Indomie goreng, telur ceplok, sawi.", price: 12000, tags: ["Favorit"] },
    { id: "indomie-kuah", category: "makanan", name: "Indomie Kuah Telur", desc: "Indomie rebus, telur, cabai rawit.", price: 12000 },
    { id: "nasi-goreng", category: "makanan", name: "Nasi Goreng", desc: "Nasi goreng kampung dengan telur.", price: 15000 },
    { id: "roti-bakar", category: "makanan", name: "Roti Bakar Cokelat Keju", desc: "Roti bakar mentega, cokelat dan keju.", price: 12000 },

    { id: "pisang-goreng", category: "camilan", name: "Pisang Goreng", desc: "Per potong.", price: 2000 },
    { id: "tahu-isi", category: "camilan", name: "Tahu Isi", desc: "Per potong.", price: 2000 },
    { id: "bakwan", category: "camilan", name: "Bakwan", desc: "Per potong.", price: 2000 },
    { id: "rempeyek", category: "camilan", name: "Rempeyek Kacang", desc: "Satu bungkus.", price: 5000 },
  ],
};
