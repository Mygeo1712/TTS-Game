const { Pool } = require('pg');

// Tambahkan baris ini untuk "membersihkan" variabel yang bentrok dari Railway
delete process.env.PGHOST;
delete process.env.PGUSER;
delete process.env.PGPASSWORD;
delete process.env.PGDATABASE;
delete process.env.PGPORT;

console.log("Checking DATABASE_URL...", process.env.DATABASE_URL ? "Tersedia" : "TIDAK DITEMUKAN");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false 
  }
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Gagal konek ke database:', err.message);
  }
  console.log('✅ Koneksi database Supabase Berhasil!');
  release();
});

module.exports = pool;