const { Pool } = require('pg');

const pool = new Pool({
  // Masukkan string koneksi Supabase Anda secara langsung di sini
  connectionString: 'postgresql://postgres:#17Desember2003@db.fztgslkithvwksebvxok.supabase.co:5432/postgres',
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