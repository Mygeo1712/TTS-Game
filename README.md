# TTS MASTER - Automatic Crossword Creator & Multiplayer
Aplikasi Fullstack Teka-Teki Silang (TTS) interaktif yang memungkinkan pengguna membuat puzzle secara otomatis melalui Admin Panel dan memainkannya secara real-time bersama pemain lain.

---

## 🚀 Live Demo & Repository
* **Live App:** [https://tts-game-production.up.railway.app/](https://tts-game-production.up.railway.app/)
* **GitHub Repository:** [https://github.com/Mygeo1712/TTS-Game](https://github.com/Mygeo1712/TTS-Game)

---

## 🛠️ Tech Stack
* **Frontend:** React.js (ESM-based, tanpa build step berat untuk performa optimal).
* **Backend:** Node.js & Express.js.
* **Database:** PostgreSQL (Hosted via Supabase).
* **Networking:** Supabase Connection Pooler (IPv4 Compatible).
* **Deployment:** Railway CI/CD (Auto-deploy dari GitHub).

---

## ✨ Fitur Utama
* **Automatic Grid Generator:** Algoritma cerdas yang menyusun kata-kata input menjadi grid TTS yang optimal.
* **Admin / Creator Panel:** Fitur untuk input kata & petunjuk, generate grid, dan simpan ke database secara langsung.
* **Real-time Multiplayer Sync:** Sinkronisasi progres jawaban dan posisi kursor antar pemain dalam satu room menggunakan sistem polling.
* **Sistem Hint & Check:** Bantuan kuota hint untuk membuka huruf dan fitur validasi jawaban benar/salah.
* **Leaderboard & Timer:** Mencatat rekor waktu tercepat penyelesaian puzzle menggunakan localStorage.
* **Responsive TTS Grid:** Tampilan grid yang adaptif mengecil secara otomatis di layar mobile.

---

## 📖 Dokumentasi API
Berikut adalah endpoint utama yang digunakan dalam aplikasi ini:

| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| **GET** | `/api/puzzles` | Mengambil daftar semua puzzle yang tersedia. |
| **POST** | `/api/puzzles` | Menyimpan puzzle baru (termasuk koordinat kata). |
| **GET** | `/api/puzzles/:id` | Mengambil detail satu puzzle beserta petunjuknya. |
| **GET** | `/api/puzzles/:id/room-state` | Mengambil status grid global dan daftar pemain. |
| **POST** | `/api/puzzles/:id/sync` | Mengirimkan update grid dan posisi kursor ke server. |

---

## 🧠 Penjelasan Algoritma (Crossword Generator)
Algoritma utama dalam `generator.js` bekerja dengan prinsip **Iterative Fitting**:

1.  **Sorting:** Mengurutkan kata dari yang terpanjang untuk meminimalisir kegagalan penempatan di awal.
2.  **Collision Check:** Memastikan setiap huruf baru tidak bertabrakan dengan huruf yang sudah ada, kecuali pada persimpangan yang sah.
3.  **Strict Neighbor Rule:** Mencegah kata-kata baru menempel di samping kata lain jika tidak membentuk persimpangan huruf.
4.  **100-Iteration Optimization:** Sistem melakukan 100 percobaan penempatan secara acak dan memilih hasil dengan kepadatan grid terbaik.

---

## ⚠️ Masalah & Solusi
1. **Masalah Koneksi Database (IPv6 vs IPv4)**
* **Masalah:**Error `ENETUNREACH` saat deployment karena ketidakcocokan protokol IPv6 di infrastruktur hosting.
* **Solusi:** Mengimplementasikan **Supabase Connection Pooler** pada port `6543` dan menggunakan konfigurasi `ssl: { rejectUnauthorized: false }` pada file `db.js` untuk memaksa koneksi via **IPv4**.

2. **Isu "ID Room Nyangkut" & Sinkronisasi Kemenangan**
* **Masalah:** Penghapusan room secara instan saat satu pemain menang menyebabkan pemain lain mengalami error `404`
* **Solusi:** Implementasi  **Soft-Finish System:** 
  - Database hanya mengubah status is_won = TRUE
  - Room dihapus setelah seluruh pemain menekan tombol "Kembali ke Menu" melalui endpoint /leave

3. **`Error Cannot read properties of undefined (reading '2')`**
* **Masalah:** Halaman blank saat loading karena fungsi statistik berjalan sebelum data grid selesai diambil.
* **Solusi:** Menambahkan **safety check** pada Player.js: `if (!grid[r]) continue;`




---

## 💻 Cara Menjalankan di Lokal
1.  **Clone repo:**
    `git clone https://github.com/Mygeo1712/TTS-Game.git`
2.  **Install library:**
    `npm install express pg`
3.  **Database:**
    Pastikan kredensial database di `db.js` sudah sesuai dan jalankan query di `db.sql`.
4.  **Jalankan aplikasi:**
    `node server.js` atau `npm start`
5.  **Akses di:**
    `http://localhost:3000`