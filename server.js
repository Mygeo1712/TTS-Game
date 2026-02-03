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

// 2. Endpoint: Simpan Puzzle Baru
app.post('/api/puzzles', async (req, res) => {
  const { title, width, height, difficulty, placed } = req.body;
  try {
    await db.query('BEGIN');
    const puzzleResult = await db.query(
      'INSERT INTO public.puzzles (title, width, height, difficulty) VALUES ($1, $2, $3, $4) RETURNING id',
      [title, width, height, difficulty]
    );
    const puzzleId = puzzleResult.rows[0].id;

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

// Endpoint: Ambil state room (Shared Win & Hints)
app.get('/api/puzzles/:id/room-state', async (req, res) => {
  const { id } = req.params;
  const { roomID } = req.query;
  if (!roomID || roomID === "SOLO") return res.json({ solo: true });

  try {
    let room = await db.query('SELECT * FROM public.puzzle_rooms WHERE room_id = $1 AND puzzle_id = $2', [roomID, id]);

    if (room.rows.length === 0) {
      // Buat room baru jika belum ada
      room = await db.query(
        'INSERT INTO public.puzzle_rooms (room_id, puzzle_id, start_time, hints_remaining, hint_cells, is_won) VALUES ($1, $2, CURRENT_TIMESTAMP, 3, $3, FALSE) RETURNING *', 
        [roomID, id, JSON.stringify([])]
      );
    }

    const players = await db.query("SELECT player_id as id, last_cursor as cursor FROM public.room_players WHERE room_id = $1 AND last_active > NOW() - INTERVAL '10 seconds'", [roomID]);

    res.json({
      startTime: room.rows[0].start_time,
      globalGrid: room.rows[0].global_grid,
      hintsRemaining: room.rows[0].hints_remaining,
      hintCells: room.rows[0].hint_cells,
      isWon: room.rows[0].is_won,
      winnerId: room.rows[0].winner_id,
      activePlayers: players.rows
    });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// Endpoint: Sinkronisasi Grid, Cursor, dan Status Menang
app.post('/api/puzzles/:id/sync', async (req, res) => {
  const { roomID, playerId, grid, cursor, hintsRemaining, hintCells, isWin, finalTime } = req.body;
  const { id } = req.params;
  if (!roomID || roomID === "SOLO") return res.sendStatus(200);

  try {
    if (isWin) {
      // 1. Masukkan ke Leaderboard
      await db.query(
        'INSERT INTO public.leaderboard (puzzle_id, player_id, completion_time) VALUES ($1, $2, $3)',
        [id, playerId, finalTime]
      );

      // 2. Tandai Room sebagai Selesai (Agar player lain melihat modal win)
      // Jangan langsung DELETE agar player lain sempat polling status is_won: true
      await db.query(
        'UPDATE public.puzzle_rooms SET global_grid = $1, is_won = TRUE, winner_id = $2 WHERE room_id = $3 AND puzzle_id = $4',
        [JSON.stringify(grid), playerId, roomID, id]
      );
      
      console.log(`🏆 Player ${playerId} memenangkan Room ${roomID}.`);
    } else {
      // Update progres rutin
      await db.query(
        'UPDATE public.puzzle_rooms SET global_grid = $1, hints_remaining = $2, hint_cells = $3 WHERE room_id = $4 AND puzzle_id = $5 AND is_won = FALSE',
        [JSON.stringify(grid), hintsRemaining, JSON.stringify(hintCells), roomID, id]
      );
    }

    // Update posisi kursor pemain
    await db.query(`
      INSERT INTO public.room_players (room_id, player_id, last_cursor, last_active) 
      VALUES ($1, $2, $3, NOW()) 
      ON CONFLICT (room_id, player_id) 
      DO UPDATE SET last_cursor = $3, last_active = NOW()`,
      [roomID, playerId, JSON.stringify(cursor)]
    );

    res.sendStatus(200);
  } catch (err) {
    console.error("Sync Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// server.js - Ambil 5 rekor tercepat global
app.get('/api/leaderboard/:puzzleId', async (req, res) => {
  try {
    const { puzzleId } = req.params;
    const result = await db.query(
      'SELECT player_id, completion_time, completion_date FROM public.leaderboard WHERE puzzle_id = $1 ORDER BY completion_time ASC LIMIT 5',
      [puzzleId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Leaderboard GET Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Meninggalkan Room & Hapus Room Jika Kosong (Final Cleanup)
app.post('/api/puzzles/:id/leave', async (req, res) => {
  const { roomID, playerId } = req.body;
  const { id } = req.params;

  try {
    // Hapus player dari daftar aktif
    await db.query('DELETE FROM public.room_players WHERE room_id = $1 AND player_id = $2', [roomID, playerId]);
    
    // Cek apakah masih ada player lain di room tersebut
    const checkPlayers = await db.query('SELECT COUNT(*) FROM public.room_players WHERE room_id = $1', [roomID]);
    
    // Jika room kosong, hapus room secara permanen agar ID bisa dipakai ulang
    if (parseInt(checkPlayers.rows[0].count) === 0) {
      await db.query('DELETE FROM public.puzzle_rooms WHERE room_id = $1', [roomID]);
      console.log(`🧹 Room ${roomID} kosong dan telah dihapus.`);
    }
    
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server berjalan di port: ${PORT}`);
});