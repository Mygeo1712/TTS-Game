const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres.fztgslkithvwksebvxok', 
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  database: 'postgres',
  password: '17Desember-2003', // Password terbaru Anda
  port: 6543,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Gagal konek ke database:', err.message);
  }
  console.log('✅ Koneksi database Supabase Berhasil via Pooler!');
  release();
});

module.exports = pool;