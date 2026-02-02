import React, { useState, useEffect, useRef } from 'react';
import { Direction } from '../generator.js';

const Player = ({ puzzle, onBack }) => {
  // --- KONFIGURASI NETWORK ---
  const API_BASE = "http://10.59.203.192:3000";

  // --- STATE DASAR ---
  const [grid, setGrid] = useState([]);
  const [cursor, setCursor] = useState({ r: 0, c: 0 });
  const [dir, setDir] = useState(Direction.ACROSS);
  const [win, setWin] = useState(false);
  const [timer, setTimer] = useState(0);

  // --- STATE PRIVATE MULTIPLAYER ---
  const [roomID, setRoomID] = useState(""); 
  const [isJoined, setIsJoined] = useState(false);
  const [otherPlayers, setOtherPlayers] = useState([]);
  const [onlineCount, setOnlineCount] = useState(1);
  const myPlayerId = useRef(`User-${Math.floor(Math.random() * 900) + 100}`);

  // --- STATE FITUR TAMBAHAN ---
  const [hintsRemaining, setHintsRemaining] = useState(3);
  const [hintCells, setHintCells] = useState(new Set());
  const [showValidation, setShowValidation] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);

  const inputRefs = useRef(new Map());
  const timerRef = useRef(null);

  // 1. Fungsi Sinkronisasi
  const syncMyState = async (updatedGrid, currentCursor) => {
    if (!puzzle?.id || !isJoined || roomID === "SOLO") return;
    try {
      const res = await fetch(`${API_BASE}/api/puzzles/${puzzle.id}/sync`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomID: roomID, 
          playerId: myPlayerId.current,
          grid: updatedGrid,
          cursor: currentCursor,
          lastActive: new Date().toISOString()
        })
      });
      if (!res.ok) {
        const errorData = await res.json();
        console.error("Sync server error:", errorData.error);
      }
    } catch (e) { 
      console.error("Sync error (Network):", e.message); 
    }
  };

  // 2. Loop Polling
  useEffect(() => {
    if (!puzzle || win || !isJoined || roomID === "SOLO") return;

    const fetchRoomState = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/puzzles/${puzzle.id}/room-state?roomID=${roomID}`, {
            mode: 'cors'
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Gagal fetch room state");
        }
        const data = await res.json();

        if (data.startTime) {
          const roomStart = new Date(data.startTime).getTime();
          const now = new Date().getTime();
          const elapsed = Math.floor((now - roomStart) / 1000);
          setTimer(elapsed > 0 ? elapsed : 0);
        }

        if (data.globalGrid && Array.isArray(data.globalGrid) && data.globalGrid.length > 0) {
           setGrid(data.globalGrid);
        }
        
        if (data.activePlayers) {
          const activeOnes = data.activePlayers.filter(p => p.id !== myPlayerId.current);
          setOtherPlayers(activeOnes);
          setOnlineCount(data.activePlayers.length);
        }
      } catch (e) { 
        console.error("Polling error details:", e.message); 
      }
    };

    const interval = setInterval(fetchRoomState, 2000);
    fetchRoomState(); 

    return () => clearInterval(interval);
  }, [puzzle, win, isJoined, roomID]);

  // 3. Inisialisasi Awal & Leaderboard
  useEffect(() => {
    if (!puzzle) return;
    
    const savedProgress = localStorage.getItem(`progress-${puzzle.id}`);
    if (savedProgress) {
      setGrid(JSON.parse(savedProgress));
    } else {
      setGrid(Array.from({ length: puzzle.height }, () => Array(puzzle.width).fill('')));
    }

    // Mengambil data leaderboard dari localStorage saat inisialisasi
    const savedLeaderboard = JSON.parse(localStorage.getItem(`leaderboard-${puzzle.id}`) || '[]');
    setLeaderboard(savedLeaderboard);

    const first = puzzle.words[0];
    if (first) {
      setCursor({ r: first.row, c: first.col });
      setDir(first.direction);
    }
    
    if (isJoined && roomID === "SOLO") {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setTimer(t => t + 1);
        }, 1000);
    }
    
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [puzzle, isJoined, roomID]);

  // Simpan progress lokal
  useEffect(() => {
    if (grid.length > 0 && puzzle?.id && !win) {
      localStorage.setItem(`progress-${puzzle.id}`, JSON.stringify(grid));
    }
  }, [grid, puzzle, win]);

  // Handle Fokus Grid
  useEffect(() => {
    if (!isJoined) return;
    const key = `${cursor.r}-${cursor.c}`;
    const targetEl = inputRefs.current.get(key);
    if (targetEl) {
      requestAnimationFrame(() => targetEl.focus());
    }
  }, [cursor, isJoined]);

  // --- LOGIKA PERMAINAN ---
  const getTargetLetter = (r, c) => {
    const w = puzzle.words.find(p => 
      p.direction === Direction.ACROSS 
        ? (p.row === r && c >= p.col && c < p.col + p.answer.length) 
        : (p.col === c && r >= p.row && r < p.row + p.answer.length)
    );
    if (!w) return null;
    return w.direction === Direction.ACROSS ? w.answer[c - w.col] : w.answer[r - w.row];
  };

  const stats = (() => {
    if (!puzzle) return { filled: 0, correct: 0, total: 0, percent: 0 };
    let filled = 0, correct = 0, total = 0;
    for (let r = 0; r < puzzle.height; r++) {
      for (let c = 0; c < puzzle.width; c++) {
        const target = getTargetLetter(r, c);
        if (target) {
          total++;
          if (grid[r]?.[c]) {
            filled++;
            if (grid[r][c] === target) correct++;
          }
        }
      }
    }
    return { filled, correct, total, percent: total > 0 ? Math.round((filled / total) * 100) : 0 };
  })();

  const handleCellSelect = (r, c) => {
    if (!isJoined) return;
    const newCursor = { r, c };
    setCursor(newCursor);
    if (isJoined) syncMyState(grid, newCursor);

    const belongsToAcross = puzzle.words.some(w => w.direction === Direction.ACROSS && w.row === r && c >= w.col && c < w.col + w.answer.length);
    const belongsToDown = puzzle.words.some(w => w.direction === Direction.DOWN && w.col === c && r >= w.row && r < w.row + w.answer.length);

    if (belongsToDown && !belongsToAcross) {
      setDir(Direction.DOWN);
    } else if (belongsToAcross && !belongsToDown) {
      setDir(Direction.ACROSS);
    }
  };

  const handleInput = (r, c, v) => {
    if (!isJoined || win) return;
    const char = v.toUpperCase().slice(-1);
    if (char && !/[A-Z]/.test(char)) return;

    if (hintCells.has(`${r}-${c}`)) {
      const newHintCells = new Set(hintCells);
      newHintCells.delete(`${r}-${c}`);
      setHintCells(newHintCells);
    }

    const nextGrid = [...grid];
    nextGrid[r][c] = char;
    setGrid(nextGrid);
    setShowValidation(false); 

    if (isJoined) syncMyState(nextGrid, cursor);

    if (char) {
      const nextR = dir === Direction.DOWN ? r + 1 : r;
      const nextC = dir === Direction.ACROSS ? c + 1 : c;
      if (getTargetLetter(nextR, nextC)) handleCellSelect(nextR, nextC);
    }

    const isWinNow = puzzle.words.every(w => {
      for(let i=0; i<w.answer.length; i++) {
        const row = w.direction === Direction.DOWN ? w.row + i : w.row;
        const col = w.direction === Direction.ACROSS ? w.col + i : w.col;
        if (nextGrid[row][col] !== w.answer[i]) return false;
      }
      return true;
    });
    
    if (isWinNow && !win) {
      handleFinishGame(timer);
    }
  };

  const handleFinishGame = (finalTime) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setWin(true);
    
    // Logika Update Rekor Tercepat
    const currentBoard = JSON.parse(localStorage.getItem(`leaderboard-${puzzle.id}`) || '[]');
    const newEntry = { time: finalTime, date: new Date().toLocaleDateString('id-ID') };
    const newBoard = [...currentBoard, newEntry].sort((a, b) => a.time - b.time).slice(0, 5);
    
    localStorage.setItem(`leaderboard-${puzzle.id}`, JSON.stringify(newBoard));
    setLeaderboard(newBoard);
    localStorage.removeItem(`progress-${puzzle.id}`);
  };

  const resetGrid = () => {
    if (window.confirm("Apakah Anda yakin ingin menghapus semua jawaban?")) {
      const emptyGrid = Array.from({ length: puzzle.height }, () => Array(puzzle.width).fill(''));
      setGrid(emptyGrid);
      setHintsRemaining(3);
      setHintCells(new Set());
      setShowValidation(false);
      localStorage.removeItem(`progress-${puzzle.id}`);
      if (isJoined) syncMyState(emptyGrid, cursor);
    }
  };

  const handleExit = () => {
    onBack();
  };

  const handleKeyDown = (e, r, c) => {
    if (!isJoined) return;
    if (e.key === 'Backspace' && !grid[r][c]) {
      const prevR = dir === Direction.DOWN ? r - 1 : r;
      const prevC = dir === Direction.ACROSS ? c - 1 : c;
      if (getTargetLetter(prevR, prevC)) handleCellSelect(prevR, prevC);
    } else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      let nr = r, nc = c;
      if (e.key === 'ArrowUp') nr--;
      if (e.key === 'ArrowDown') nr++;
      if (e.key === 'ArrowLeft') nc--;
      if (e.key === 'ArrowRight') nc++;
      if (getTargetLetter(nr, nc)) handleCellSelect(nr, nc);
    }
  };

  const useHint = () => {
    if (hintsRemaining <= 0) return alert("Kuota Hint sudah habis!");
    const emptyCells = [];
    for (let r = 0; r < puzzle.height; r++) {
      for (let c = 0; c < puzzle.width; c++) {
        const correctChar = getTargetLetter(r, c);
        if (correctChar && grid[r][c] !== correctChar) {
            emptyCells.push({ r, c, char: correctChar });
        }
      }
    }
    if (emptyCells.length === 0) return alert("Semua sel yang benar sudah terisi!");
    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const nextGrid = [...grid];
    nextGrid[randomCell.r][randomCell.c] = randomCell.char;
    const newHintCells = new Set(hintCells);
    newHintCells.add(`${randomCell.r}-${randomCell.c}`);
    setGrid(nextGrid);
    setHintCells(newHintCells);
    setHintsRemaining(prev => prev - 1);
    if (isJoined) syncMyState(nextGrid, { r: randomCell.r, c: randomCell.c });
    handleCellSelect(randomCell.r, randomCell.c);
  };

  const exportToPDF = () => { window.print(); };
  const fmtTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  const activeClue = puzzle.words.find(w => w.direction === dir && (dir === Direction.ACROSS ? (w.row === cursor.r && cursor.c >= w.col && cursor.c < w.col + w.answer.length) : (w.col === cursor.c && cursor.r >= w.row && cursor.r < w.row + w.answer.length)));

  return React.createElement('div', { className: 'space-y-4 max-h-screen flex flex-col p-2 animate-in fade-in duration-700 print:bg-white' }, [

    !isJoined && React.createElement('div', { key: 'join-modal', className: 'fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 backdrop-blur-md' },
      React.createElement('div', { className: 'bg-[#1e293b] p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center border border-gray-700' }, [
        React.createElement('h3', { className: 'text-3xl font-black mb-2 text-white uppercase tracking-tight' }, 'MULAI BERMAIN'),
        React.createElement('p', { className: 'text-sm text-gray-400 mb-6' }, 'Masukkan Kode Room yang sama untuk bermain dengan teman Anda.'),
        React.createElement('input', {
          placeholder: 'KODE ROOM...',
          className: 'w-full p-4 bg-[#334155] border-2 border-gray-600 rounded-xl mb-6 text-center font-black uppercase text-xl text-white outline-none focus:border-blue-500 transition-all placeholder:text-gray-500',
          value: roomID,
          onChange: e => setRoomID(e.target.value.toUpperCase()),
          autoFocus: true
        }),
        React.createElement('div', { className: 'flex flex-col gap-3' }, [
          React.createElement('button', {
            onClick: () => { if (roomID.trim()) { setIsJoined(true); } else alert("Masukkan Kode Room!"); },
            className: 'w-full py-4 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-lg active:scale-95 transition-all'
          }, 'MASUK KE ROOM'),
          React.createElement('button', {
            onClick: () => { setRoomID("SOLO"); setIsJoined(true); },
            className: 'w-full py-3 text-gray-400 font-bold hover:text-white transition-colors'
          }, 'Main Sendirian (Solo)')
        ])
      ])
    ),

    // Header
    React.createElement('div', {
      key: 'h',
      className: 'flex flex-wrap justify-between items-center gap-2 bg-white dark:bg-gray-800 p-3 card shadow-md shrink-0 transition-colors border-black dark:border-white print:hidden'
    }, [
      React.createElement('div', null, [
        React.createElement('h2', { className: 'text-lg font-black uppercase text-black dark:text-white leading-tight' }, puzzle.title),
        React.createElement('div', { className: 'flex flex-wrap gap-2 mt-1' }, [
          React.createElement('span', { className: 'text-[9px] font-bold bg-green-500 text-white px-2 py-0.5 rounded animate-pulse' },
            `👥 ${isJoined && roomID !== "SOLO" ? `ROOM: ${roomID} (${onlineCount})` : 'SOLO'}`
          ),
          React.createElement('span', { className: `text-[9px] font-bold ${win ? 'bg-green-600' : 'bg-black dark:bg-gray-700'} text-white px-2 py-0.5 rounded` }, `⏱️ ${fmtTime(timer)}`),
          React.createElement('span', { className: 'text-[9px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded' }, `🆔 ${myPlayerId.current}`),
        ])
      ]),
      React.createElement('div', { className: 'flex gap-1.5' }, [
        React.createElement('button', { onClick: exportToPDF, className: 'px-3 py-1 bg-blue-500 text-white font-black text-[10px] card border-black' }, '📑 PDF'),
        React.createElement('button', { 
            onClick: useHint, 
            disabled: hintsRemaining <= 0,
            className: `px-3 py-1 font-black text-[10px] card border-black transition-colors ${hintsRemaining > 0 ? 'bg-yellow-400 hover:bg-yellow-300' : 'bg-gray-400 cursor-not-allowed'}` 
        }, `HINT (${hintsRemaining})`),
        React.createElement('button', { onClick: () => setShowValidation(true), className: 'px-3 py-1 bg-green-500 text-white font-black text-[10px] card border-black hover:bg-green-400' }, 'CHECK'),
        React.createElement('button', { onClick: resetGrid, className: 'px-3 py-1 bg-red-500 text-white font-black text-[10px] card border-black hover:bg-red-400' }, 'RESET'),
        React.createElement('button', { onClick: handleExit, className: 'px-3 py-1 bg-black dark:bg-gray-900 text-white font-black text-[10px] card border-black dark:border-gray-500 hover:opacity-80' }, 'KELUAR')
      ])
    ]),

    // Progress Bar
    React.createElement('div', { key: 'pb', className: 'w-full h-3 bg-gray-200 dark:bg-gray-700 border border-black dark:border-gray-600 overflow-hidden shrink-0 print:hidden' },
      React.createElement('div', {
        className: 'h-full bg-blue-500 transition-all duration-1000 ease-out flex items-center justify-center text-[7px] font-black text-white',
        style: { width: `${stats.percent}%` }
      }, stats.percent > 10 ? `${stats.percent}%` : '')
    ),

    // Main Game Area
    React.createElement('div', { key: 'g', className: 'flex flex-col lg:flex-row gap-4 overflow-hidden flex-1' }, [
      React.createElement('div', { className: 'flex-1 flex justify-center items-center bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden p-2 transition-colors print:bg-white' }, 
        React.createElement('div', { 
          className: 'inline-grid bg-gray-900 dark:bg-black gap-px border-2 border-black p-1 shadow-2xl relative print:shadow-none',
          style: { 
            gridTemplateColumns: `repeat(${puzzle.width}, minmax(15px, 1fr))`,
            width: '100%', maxWidth: '400px', aspectRatio: `${puzzle.width} / ${puzzle.height}`
          }
        }, Array.from({ length: puzzle.height * puzzle.width }).map((_, i) => {
          const r = Math.floor(i / puzzle.width), c = i % puzzle.width;
          const target = getTargetLetter(r, c), active = cursor.r === r && cursor.c === c;
          const start = puzzle.words.find(w => w.row === r && w.col === c);
          const pLain = otherPlayers.find(p => p.cursor?.r === r && p.cursor?.c === c);
          const isLocked = !!pLain;
          const isHintCell = hintCells.has(`${r}-${c}`);

          let cellBg = !target ? 'bg-gray-900 dark:bg-black' : 'bg-white';
          if (showValidation && target && grid[r][c]) {
            cellBg = grid[r][c] === target ? 'bg-green-500' : 'bg-red-500';
          }

          return React.createElement('div', { 
            key: i, 
            className: `grid-cell relative transition-all duration-300 ${cellBg} ${active ? 'ring-2 ring-blue-500 z-10 scale-[1.02]' : ''}`,
            style: { 
              backgroundColor: isLocked ? '#facc15' : undefined,
              opacity: isLocked ? 0.7 : 1
            },
            onClick: () => target && handleCellSelect(r, c)
          }, [
            start && React.createElement('span', { key: 'num', className: 'absolute top-0.5 left-0.5 text-[6px] sm:text-[8px] font-black z-10 text-gray-500 print:text-black' }, start.number),
            isLocked && React.createElement('span', { key: 'p-name', className: 'absolute -top-3 left-0 bg-black text-white text-[5px] px-1 font-bold rounded z-20 whitespace-nowrap' }, pLain.id),
            target && React.createElement('input', {
              disabled: isLocked || !isJoined,
              ref: (el) => { if (el) inputRefs.current.set(`${r}-${c}`, el); },
              className: `w-full h-full text-center font-black text-xs sm:text-base uppercase focus:outline-none bg-transparent p-0 print:text-black ${isLocked ? 'cursor-not-allowed' : ''} ${
                isHintCell ? 'text-green-600' : 'text-black dark:text-black'
              }`,
              value: grid[r]?.[c] || '', 
              onChange: e => handleInput(r, c, e.target.value),
              onKeyDown: e => handleKeyDown(e, r, c),
              onFocus: () => handleCellSelect(r, c)
            })
          ]);
        }))
      ),

      // Sidebar
      React.createElement('div', { className: 'w-full lg:w-64 flex flex-col gap-2 shrink-0 print:block overflow-hidden' }, [
        
        // --- 🏆 TAMPILAN REKOR TERCEPAT ---
        leaderboard.length > 0 && React.createElement('div', { key: 'lb', className: 'p-3 bg-yellow-50 dark:bg-gray-800 card border-black dark:border-white border-l-4 border-l-yellow-400 transition-colors' }, [
          React.createElement('h4', { className: 'text-[10px] font-black uppercase mb-2 text-yellow-700 dark:text-yellow-400 flex items-center gap-1' }, [
            React.createElement('span', null, '🏆'),
            React.createElement('span', null, 'Rekor Tercepat')
          ]),
          leaderboard.map((entry, idx) => React.createElement('div', { key: idx, className: 'flex justify-between text-[10px] font-bold border-b border-yellow-100 dark:border-gray-700 py-1 last:border-0 dark:text-gray-200' }, [
            React.createElement('span', null, `${idx + 1}. ${entry.date}`),
            React.createElement('span', { className: 'text-blue-600 dark:text-blue-400' }, fmtTime(entry.time))
          ]))
        ]),

        React.createElement('div', { key: 'room-activity', className: 'p-3 bg-blue-50 dark:bg-gray-800 card border-black dark:border-white border-l-4 border-l-blue-600' }, [
          React.createElement('h4', { className: 'text-[10px] font-black uppercase mb-1 dark:text-blue-400' }, '👥 Room Activity'),
          React.createElement('p', { className: 'text-[9px] font-bold text-blue-600 dark:text-blue-300' }, `• ${myPlayerId.current} (Anda)`),
          otherPlayers.map(p => React.createElement('p', { key: p.id, className: 'text-[9px] font-bold text-gray-500 dark:text-gray-400 animate-pulse' }, `• ${p.id} sedang aktif`))
        ]),
        React.createElement('div', {
          key: 'stats-box',
          className: 'p-3 bg-white dark:bg-gray-800 card border-black dark:border-white border-l-4 border-l-blue-600 shrink-0 shadow-sm print:border-none'
        }, [
          React.createElement('h4', {
            className: 'text-[9px] font-black uppercase opacity-40 dark:opacity-60 text-black dark:text-white print:hidden'
          }, 'SEDANG DIISI'),
          React.createElement('p', {
            className: 'font-bold text-[11px] text-black dark:text-white print:hidden mt-1 leading-snug'
          }, activeClue ? `${activeClue.number}. ${activeClue.clue}` : 'Klik kotak untuk melihat petunjuk')
        ]),
        React.createElement('div', { key: 'clues-list', className: 'flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[150px]' }, 
          ['ACROSS', 'DOWN'].map(d => React.createElement('div', { key: d, className: 'bg-white dark:bg-gray-800 dark:text-white p-2 card border-black dark:border-white' }, [
            React.createElement('h5', { className: 'text-[9px] font-black border-b border-black dark:border-gray-500 mb-1 pb-0.5' }, d === 'ACROSS' ? 'MENDATAR' : 'MENURUN'),
            React.createElement('ul', { className: 'text-[9px] space-y-1 mt-1' }, 
              puzzle.words.filter(w => w.direction === d).map(w => React.createElement('li', {
                key: w.number, 
                className: `cursor-pointer p-1.5 rounded transition-all leading-tight ${cursor.r === w.row && cursor.c === w.col && dir === d ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200 font-black' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-400 font-medium'}`,
                onClick: () => { handleCellSelect(w.row, w.col); if(d === 'DOWN') setDir(Direction.DOWN); else setDir(Direction.ACROSS); }
              }, `${w.number}. ${w.clue}`))
            )
          ]))
        )
      ])
    ]),

    // Modal Kemenangan
    win && React.createElement('div', { className: 'fixed inset-0 bg-black/90 flex items-center justify-center z-[250] p-4 backdrop-blur-md' }, 
      React.createElement('div', { className: 'text-center p-8 card bg-white dark:bg-gray-800 border-black dark:border-white max-w-xs w-full shadow-2xl animate-in zoom-in duration-300' }, [
        React.createElement('div', { className: 'text-5xl mb-4' }, '🎉'),
        React.createElement('h2', { className: 'text-3xl font-black mb-2 italic dark:text-white' }, 'MENANG!'),
        React.createElement('p', { className: 'text-sm font-bold mb-6 dark:text-gray-300' }, `Kamu menyelesaikan dalam waktu ${fmtTime(timer)}`),
        React.createElement('button', { onClick: handleExit, className: 'w-full py-4 bg-black dark:bg-white text-white dark:text-black font-black uppercase card border-black text-xs hover:scale-95 transition-transform' }, 'KEMBALI KE MENU')
      ])
    )
  ]);
};

export default Player;