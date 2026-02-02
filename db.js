const { Pool } = require('pg');

const pool = new Pool({
  // Gunakan URI dari Session Pooler (Port 6543)
  connectionString: 'postgresql://postgres.fztgslkithvwksebvxok:17Desember-2003@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
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