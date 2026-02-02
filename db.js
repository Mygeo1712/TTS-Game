const { Pool } = require('pg');

// Solusi paksa: Memecah kredensial agar tidak terjadi ENOTFOUND postgres
const pool = new Pool({
  user: 'postgres',
  host: 'db.fztgslkithvwksebvxok.supabase.co',
  database: 'postgres',
  password: '#17Des2003',
  port: 5432,
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