const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: '127.0.0.1', // Menggunakan IP untuk menghindari isu resolusi localhost
  database: 'Test',   // Pastikan 'T' kapital sesuai yang terlihat di pgAdmin
  password: '#17Des2003', 
  port: 5432,
});

// Test koneksi saat server dinyalakan
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Gagal konek ke database:', err.stack);
  }
  console.log('✅ Koneksi database PostgreSQL Berhasil!');
  release();
});

module.exports = pool;