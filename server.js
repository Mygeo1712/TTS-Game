const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./db.js');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 1. Endpoint: Ambil semua daftar puzzle
app.get('/api/puzzles', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM public.puzzles ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Endpoint: Simpan Puzzle Baru (PERBAIKAN: Menambahkan POST route yang hilang)
app.post('/api/puzzles', async (req, res) => {
  const { title, width, height, difficulty, placed } = req.body;
  
  try {
    // Mulai Transaksi Database
    await db.query('BEGIN');

    // Simpan ke tabel puzzles
    const puzzleResult = await db.query(
      'INSERT INTO public.puzzles (title, width, height, difficulty) VALUES ($1, $2, $3, $4) RETURNING id',
      [title, width, height, difficulty]
    );
    const puzzleId = puzzleResult.rows[0].id;

    // Simpan kata-kata ke tabel puzzle_words
    for (const word of placed) {
      await db.query(
        'INSERT INTO public.puzzle_words (puzzle_id, answer, clue, row_pos, col_pos, direction, word_number) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [puzzleId, word.answer, word.clue, word.row, word.col, word.direction, word.number]
      );
    }

    await db.query('COMMIT');
    res.status(201).json({ id: puzzleId });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error("Error Saving Puzzle:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 3. Endpoint: Ambil detail satu puzzle
app.get('/api/puzzles/:id', async (req, res) => {
  try {
    const puzzle = await db.query('SELECT * FROM public.puzzles WHERE id = $1', [req.params.id]);
    if (puzzle.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const words = await db.query('SELECT * FROM public.puzzle_words WHERE puzzle_id = $1', [req.params.id]);
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

// --- LOGIKA MULTIPLAYER SINKRON ---

app.get('/api/puzzles/:id/room-state', async (req, res) => {
  const { id } = req.params;
  const { roomID } = req.query;
  if (!roomID || roomID === "SOLO") return res.json({ solo: true });

  try {
    let room = await db.query('SELECT start_time, global_grid FROM public.puzzle_rooms WHERE room_id = $1 AND puzzle_id = $2', [roomID, id]);
    
    if (room.rows.length === 0) {
      room = await db.query('INSERT INTO public.puzzle_rooms (room_id, puzzle_id, start_time) VALUES ($1, $2, NOW()) RETURNING *', [roomID, id]);
    }
    
    const players = await db.query("SELECT player_id as id, last_cursor as cursor FROM public.room_players WHERE room_id = $1 AND last_active > NOW() - INTERVAL '10 seconds'", [roomID]);
    
    res.json({
      startTime: room.rows[0].start_time,
      globalGrid: room.rows[0].global_grid,
      activePlayers: players.rows
    });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

app.post('/api/puzzles/:id/sync', async (req, res) => {
  const { roomID, playerId, grid, cursor } = req.body;
  const { id } = req.params;
  if (!roomID || roomID === "SOLO") return res.sendStatus(200);

  try {
    await db.query('UPDATE public.puzzle_rooms SET global_grid = $1 WHERE room_id = $2 AND puzzle_id = $3', [JSON.stringify(grid), roomID, id]);
    await db.query(`INSERT INTO public.room_players (room_id, player_id, last_cursor, last_active) VALUES ($1, $2, $3, NOW()) 
                    ON CONFLICT (room_id, player_id) DO UPDATE SET last_cursor = $3, last_active = NOW()`, [roomID, playerId, JSON.stringify(cursor)]);
    res.sendStatus(200);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server berjalan di: http://localhost:${PORT}`);
  console.log(`🌐 Akses dari HP gunakan: http://10.59.203.192:${PORT}`);
});