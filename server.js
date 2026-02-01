
const express = require('express');
const path = require('path');
const db = require('./db.js');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

// Endpoint: Ambil semua daftar puzzle
app.get('/api/puzzles', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM puzzles ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Ambil detail satu puzzle (termasuk kata-katanya)
app.get('/api/puzzles/:id', async (req, res) => {
  try {
    const puzzle = await db.query('SELECT * FROM puzzles WHERE id = $1', [req.params.id]);
    if (puzzle.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const words = await db.query('SELECT * FROM puzzle_words WHERE puzzle_id = $1', [req.params.id]);
    res.json({
      ...puzzle.rows[0],
      words: words.rows.map(w => ({
        answer: w.answer,
        clue: w.clue,
        row: w.row_pos,
        col: w.col_pos,
        direction: w.direction,
        number: w.word_number
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Simpan puzzle baru
app.post('/api/puzzles', async (req, res) => {
  const { title, width, height, difficulty, placed } = req.body;
  try {
    await db.query('BEGIN');
    const pRes = await db.query(
      'INSERT INTO puzzles (title, width, height, difficulty) VALUES ($1, $2, $3, $4) RETURNING id',
      [title, width, height, difficulty]
    );
    const pId = pRes.rows[0].id;
    for (const w of placed) {
      await db.query(
        'INSERT INTO puzzle_words (puzzle_id, answer, clue, row_pos, col_pos, direction, word_number) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [pId, w.answer, w.clue, w.row, w.col, w.direction, w.number]
      );
    }
    await db.query('COMMIT');
    res.json({ success: true, id: pId });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

/**
 * Perbaikan Error: PathError pada Express 5
 * Di Express 5, wildcard '*' murni tidak didukung tanpa nama.
 * Gunakan parameter bernama dengan quantifier (contoh: /:any*)
 * untuk menangkap semua route dan mengarahkan ke index.html.
 */
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di: http://localhost:${PORT}`);
});
