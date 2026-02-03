import React, { useState, useEffect, useRef } from 'react';
import { Direction } from '../generator.js';

const Player = ({ puzzle, onBack }) => {
  const API_BASE = window.location.origin;

  // --- STATE DASAR ---
  const [grid, setGrid] = useState([]);
  const [cursor, setCursor] = useState({ r: 0, c: 0 });
  const [dir, setDir] = useState(Direction.ACROSS);
  const [win, setWin] = useState(false);
  const [timer, setTimer] = useState(0);

  // --- STATE MULTIPLAYER ---
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
  
  const cellTimestamps = useRef(new Map()); 
  const hasLoadedFromServer = useRef(false);

  // 1. Fungsi Sinkronisasi
  const syncMyState = async (updatedGrid, currentCursor, updatedHints, updatedHintCells, isWinTrigger = false) => {
    if (!puzzle?.id || !isJoined || roomID === "SOLO") return;
    if (!hasLoadedFromServer.current && !isWinTrigger) return;

    try {
      await fetch(`${API_BASE}/api/puzzles/${puzzle.id}/sync`, {
        method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          roomID, playerId: myPlayerId.current, grid: updatedGrid, cursor: currentCursor, 
          hintsRemaining: updatedHints !== undefined ? updatedHints : hintsRemaining,
          hintCells: updatedHintCells !== undefined ? Array.from(updatedHintCells) : Array.from(hintCells),
          isWin: isWinTrigger,
          finalTime: isWinTrigger ? timer : null
        })
      });
    } catch (e) { console.error("Sync error:", e.message); }
  };

  // Fungsi Ambil Leaderboard Global dari DB
  const fetchGlobalLeaderboard = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/leaderboard/${puzzle.id}`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch (e) { console.error("Leaderboard fetch error"); }
  };

  // Fungsi Keluar & Cleanup
  const handleExitGame = async () => {
    if (isJoined && roomID !== "SOLO") {
      try {
        await fetch(`${API_BASE}/api/puzzles/${puzzle.id}/leave`, {
          method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomID, playerId: myPlayerId.current })
        });
      } catch (e) {}
    }
    onBack();
  };

  // 2. Loop Polling
  useEffect(() => {
    if (!puzzle || win || !isJoined || roomID === "SOLO") return;

    const fetchRoomState = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/puzzles/${puzzle.id}/room-state?roomID=${roomID}`, { mode: 'cors' });
        if (res.status === 404) {
          setWin(true);
          if (timerRef.current) clearInterval(timerRef.current);
          fetchGlobalLeaderboard();
          return;
        }
        if (!res.ok) return;
        const data = await res.json();

        if (data.isWon) {
          setWin(true);
          if (timerRef.current) clearInterval(timerRef.current);
          if (data.globalGrid) setGrid(data.globalGrid);
          fetchGlobalLeaderboard();
          return; 
        }

        if (data.startTime) {
          const roomStart = new Date(data.startTime).getTime();
          setTimer(Math.floor((Date.now() - roomStart) / 1000));
        }
        if (data.hintsRemaining !== undefined) setHintsRemaining(data.hintsRemaining);
        if (data.hintCells) setHintCells(new Set(data.hintCells));

        if (data.globalGrid && Array.isArray(data.globalGrid)) {
          hasLoadedFromServer.current = true;
          setGrid(prevGrid => {
            if (prevGrid.length === 0) return data.globalGrid;
            const now = Date.now();
            return prevGrid.map((row, r) => 
              row.map((cell, c) => {
                const serverCell = data.globalGrid[r] ? data.globalGrid[r][c] : '';
                const lastTouch = cellTimestamps.current.get(`${r}-${c}`) || 0;
                if (now - lastTouch < 4000) return cell !== '' ? cell : serverCell;
                return serverCell;
              })
            );
          });
        }
        if (data.activePlayers) {
          setOtherPlayers(data.activePlayers.filter(p => p.id !== myPlayerId.current));
          setOnlineCount(data.activePlayers.length);
        }
      } catch (e) { console.error("Polling error"); }
    };

    const interval = setInterval(fetchRoomState, 2000);
    fetchRoomState(); 
    return () => clearInterval(interval);
  }, [puzzle, win, isJoined, roomID]);

  // 3. Inisialisasi
  useEffect(() => {
    if (!puzzle || !isJoined) return;
    setWin(false); setTimer(0); setHintsRemaining(3); setHintCells(new Set());
    hasLoadedFromServer.current = false; cellTimestamps.current.clear();

    if (roomID !== "SOLO") {
        setGrid(Array.from({ length: puzzle.height }, () => Array(puzzle.width).fill('')));
    } else {
        hasLoadedFromServer.current = true;
        const saved = localStorage.getItem(`progress-${puzzle.id}`);
        setGrid(saved ? JSON.parse(saved) : Array.from({ length: puzzle.height }, () => Array(puzzle.width).fill('')));
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    }
    fetchGlobalLeaderboard();
    const first = puzzle.words[0];
    if (first) { setCursor({ r: first.row, c: first.col }); setDir(first.direction); }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [puzzle, isJoined, roomID]);

  useEffect(() => {
    if (!isJoined || win) return;
    inputRefs.current.get(`${cursor.r}-${cursor.c}`)?.focus();
  }, [cursor, isJoined, win]);

  // --- LOGIKA GAMEPLAY ---
  const getTargetLetter = (r, c) => {
    const w = puzzle.words.find(p => p.direction === Direction.ACROSS ? (p.row === r && c >= p.col && c < p.col + p.answer.length) : (p.col === c && r >= p.row && r < p.row + p.answer.length));
    return w ? (w.direction === Direction.ACROSS ? w.answer[c - w.col] : w.answer[r - w.row]) : null;
  };

  const checkIsWin = (currentGrid) => {
    if (!currentGrid || currentGrid.length === 0) return false;
    return puzzle.words.every(w => w.answer.split('').every((l, i) => {
        const row = w.direction === Direction.DOWN ? w.row + i : w.row;
        const col = w.direction === Direction.ACROSS ? w.col + i : w.col;
        return currentGrid[row] && currentGrid[row][col] === l;
    }));
  };

  const handleCheck = () => {
    setShowValidation(true);
    if (checkIsWin(grid)) {
      setWin(true);
      if (timerRef.current) clearInterval(timerRef.current);
      syncMyState(grid, cursor, hintsRemaining, hintCells, true);
    }
  };

  const stats = (() => {
    if (!puzzle || !grid || grid.length === 0) return { filled: 0, total: 0, percent: 0 };
    let total = 0, filled = 0;
    for (let r = 0; r < puzzle.height; r++) {
      for (let c = 0; c < puzzle.width; c++) {
        if (getTargetLetter(r, c)) { total++; if (grid[r]?.[c]) filled++; }
      }
    }
    return { filled, total, percent: total > 0 ? Math.round((filled / total) * 100) : 0 };
  })();

  const handleInput = (r, c, v) => {
    if (!isJoined || win || !grid[r]) return;
    const char = v.toUpperCase().slice(-1);
    if (char && !/[A-Z]/.test(char)) return;

    cellTimestamps.current.set(`${r}-${c}`, Date.now());
    const nextGrid = [...grid]; nextGrid[r] = [...nextGrid[r]]; nextGrid[r][c] = char;
    setGrid(nextGrid); setShowValidation(false);

    if (checkIsWin(nextGrid)) {
        setWin(true);
        if (timerRef.current) clearInterval(timerRef.current);
        syncMyState(nextGrid, { r, c }, hintsRemaining, hintCells, true);
    } else {
        syncMyState(nextGrid, { r, c });
        if (char) {
          const nR = dir === Direction.DOWN ? r + 1 : r, nC = dir === Direction.ACROSS ? c + 1 : c;
          if (getTargetLetter(nR, nC)) handleCellSelect(nR, nC);
        }
    }
  };

  const handleCellSelect = (r, c) => {
    if (!isJoined || win) return;
    setCursor({ r, c });
    syncMyState(grid, { r, c });
    const bAcross = puzzle.words.some(w => w.direction === Direction.ACROSS && w.row === r && c >= w.col && c < w.col + w.answer.length);
    const bDown = puzzle.words.some(w => w.direction === Direction.DOWN && w.col === c && r >= w.row && r < w.row + w.answer.length);
    if (bDown && !bAcross) setDir(Direction.DOWN);
    else if (bAcross && !bDown) setDir(Direction.ACROSS);
  };

  const handleKeyDown = (e, r, c) => {
    if (!isJoined || win) return;
    if (e.key === 'Backspace' && !grid[r][c]) {
      const prevR = dir === Direction.DOWN ? r - 1 : r, prevC = dir === Direction.ACROSS ? c - 1 : c;
      if (getTargetLetter(prevR, prevC)) handleCellSelect(prevR, prevC);
    } 
    else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      let nr = r, nc = c;
      if (e.key === 'ArrowUp') nr--; if (e.key === 'ArrowDown') nr++;
      if (e.key === 'ArrowLeft') nc--; if (e.key === 'ArrowRight') nc++;
      if (getTargetLetter(nr, nc)) handleCellSelect(nr, nc);
    }
  };

  const useHint = () => {
    if (hintsRemaining <= 0 || win) return alert("Sisa Hint habis!");
    const empty = [];
    for(let r=0; r<puzzle.height; r++) for(let c=0; c<puzzle.width; c++) {
        const target = getTargetLetter(r, c);
        if (target && grid[r][c] !== target) empty.push({r, c, char: target});
    }
    if (empty.length === 0) return;
    const lucky = empty[Math.floor(Math.random() * empty.length)];
    cellTimestamps.current.set(`${lucky.r}-${lucky.c}`, Date.now());
    const nextGrid = [...grid]; nextGrid[lucky.r] = [...nextGrid[lucky.r]]; nextGrid[lucky.r][lucky.c] = lucky.char;
    const nextHints = hintsRemaining - 1;
    const nextHintCells = new Set(hintCells).add(`${lucky.r}-${lucky.c}`);
    setGrid(nextGrid); setHintCells(nextHintCells); setHintsRemaining(nextHints); 
    syncMyState(nextGrid, { r: lucky.r, c: lucky.c }, nextHints, nextHintCells);
  };

  const resetGrid = () => {
    if (window.confirm("Hapus progres room ini?")) {
      const empty = Array.from({ length: puzzle.height }, () => Array(puzzle.width).fill(''));
      cellTimestamps.current.clear();
      setGrid(empty); setHintsRemaining(3); setHintCells(new Set());
      syncMyState(empty, cursor, 3, new Set());
    }
  };

  const fmtTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  const activeClue = puzzle.words.find(w => w.direction === dir && (dir === Direction.ACROSS ? (w.row === cursor.r && cursor.c >= w.col && cursor.c < w.col + w.answer.length) : (w.col === cursor.c && cursor.r >= w.row && cursor.r < w.row + w.answer.length)));

  return React.createElement('div', { className: 'w-full flex flex-col gap-4 animate-in fade-in duration-700 font-sans px-2 text-black dark:text-white' }, [

    !isJoined && React.createElement('div', { key: 'm', className: 'fixed inset-0 bg-black/90 z-[500] flex items-center justify-center p-6 backdrop-blur-md' },
      React.createElement('div', { className: 'bg-[#1e293b] p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center border border-gray-700' }, [
        React.createElement('h3', { className: 'text-2xl font-black mb-6 text-white uppercase' }, 'MULAI BERMAIN'),
        React.createElement('input', { placeholder: 'KODE ROOM...', className: 'w-full p-4 bg-[#334155] border-2 border-gray-600 rounded-xl mb-4 text-center font-bold text-xl text-white outline-none focus:border-blue-500', value: roomID, onChange: e => setRoomID(e.target.value.toUpperCase()) }),
        React.createElement('button', { onClick: () => roomID.trim() ? setIsJoined(true) : alert("Isi Kode!"), className: 'w-full py-4 bg-blue-600 text-white font-bold rounded-xl active:scale-95' }, 'MASUK KE ROOM'),
        React.createElement('button', { onClick: () => { setRoomID("SOLO"); setIsJoined(true); }, className: 'w-full py-2 mt-2 text-gray-400 font-bold hover:text-white transition-colors' }, 'Main Sendirian (Solo)')
      ])
    ),

    React.createElement('div', { key: 'h', className: 'flex flex-wrap justify-between items-center gap-2 bg-white dark:bg-gray-800 p-3 card shadow-md border-black dark:border-gray-600 transition-colors' }, [
      React.createElement('div', null, [
        React.createElement('h2', { className: 'text-lg font-black uppercase' }, puzzle.title),
        React.createElement('div', { className: 'flex flex-wrap gap-2 mt-1' }, [
          React.createElement('span', { className: 'text-[9px] font-bold bg-green-500 text-white px-2 py-0.5 rounded' }, `👥 ${roomID !== "SOLO" ? `ROOM: ${roomID} (${onlineCount})` : 'SOLO'}`),
          React.createElement('span', { className: `text-[9px] font-bold ${win ? 'bg-green-600' : 'bg-black dark:bg-gray-700'} text-white px-2 py-0.5 rounded` }, `⏱️ ${fmtTime(timer)}`),
          React.createElement('span', { className: 'text-[9px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded' }, `🆔 ${myPlayerId.current}`),
        ])
      ]),
      React.createElement('div', { className: 'flex gap-1.5' }, [
        React.createElement('button', { onClick: () => window.print(), className: 'px-3 py-1 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-bold text-[10px] card border-black' }, '📑 PDF'),
        React.createElement('button', { onClick: useHint, disabled: hintsRemaining <= 0 || win, className: `px-3 py-1 font-black text-[10px] card border-black ${hintsRemaining > 0 && !win ? 'bg-yellow-400 text-black' : 'bg-gray-300 text-gray-500'}` }, `HINT (${hintsRemaining})`),
        React.createElement('button', { onClick: handleCheck, disabled: win, className: 'px-3 py-1 bg-green-500 text-white font-black text-[10px] card border-black' }, 'CHECK'),
        React.createElement('button', { onClick: resetGrid, disabled: win, className: 'px-3 py-1 bg-red-500 text-white font-black text-[10px] card border-black' }, 'RESET'),
        React.createElement('button', { onClick: handleExitGame, className: 'px-3 py-1 bg-black text-white font-black text-[10px] card border-black' }, 'KELUAR')
      ])
    ]),

    React.createElement('div', { key: 'p', className: 'h-2.5 w-full bg-gray-200 dark:bg-gray-700 border border-black dark:border-gray-600 overflow-hidden rounded-full shadow-inner' },
      React.createElement('div', { className: 'h-full bg-blue-500 transition-all duration-500 shadow-md', style: { width: `${stats.percent}%` } })
    ),

    React.createElement('main', { key: 'main', className: 'w-full flex flex-col lg:flex-row gap-4 mb-20' }, [
      React.createElement('section', { className: 'w-full lg:flex-[2] bg-slate-200 dark:bg-slate-900/50 p-4 flex items-center justify-center overflow-auto custom-scrollbar border-2 border-black dark:border-gray-700 rounded-xl shadow-lg' }, 
        grid && grid.length > 0 && React.createElement('div', {
          className: 'bg-black dark:bg-slate-800 p-4 rounded-xl shadow-2xl relative mx-auto my-auto',
          style: {
            display: 'grid', gap: '2px', gridTemplateColumns: `repeat(${puzzle.width}, var(--cell-size))`,
            '--cell-size': `max(36px, min(calc(90vw / ${puzzle.width}), 45px))`
          }
        }, Array.from({ length: puzzle.height * puzzle.width }).map((_, i) => {
          const r = Math.floor(i / puzzle.width), c = i % puzzle.width;
          const target = getTargetLetter(r, c), active = cursor.r === r && cursor.c === c;
          const start = puzzle.words.find(w => w.row === r && w.col === c);
          const pOther = otherPlayers.find(p => p.cursor?.r === r && p.cursor?.c === c);
          if (!target) return React.createElement('div', { key: i, className: 'grid-cell black bg-gray-900 dark:bg-black' });
          const cellVal = grid[r]?.[c] || '';
          let cellBg = 'bg-white dark:bg-slate-100';
          if (showValidation && cellVal) cellBg = cellVal === target ? 'bg-green-500 text-white' : 'bg-red-500 text-white';
          return React.createElement('div', {
            key: i, onClick: () => !win && handleCellSelect(r, c),
            className: `grid-cell relative transition-all ${active ? 'ring-4 ring-blue-500 z-10 scale-105 bg-blue-50' : cellBg} ${pOther ? 'ring-2 ring-yellow-400' : ''}`,
            style: { backgroundColor: pOther ? '#facc15' : undefined }
          }, [
            start && React.createElement('span', { className: 'grid-cell-number text-gray-500 dark:text-gray-600 font-black select-none text-[8px]' }, start.number),
            pOther && React.createElement('div', { className: 'absolute -top-4 left-0 bg-yellow-400 text-[7px] px-1 font-black rounded text-black z-30 shadow' }, pOther.id),
            React.createElement('input', {
              disabled: win, ref: el => inputRefs.current.set(`${r}-${c}`, el),
              className: `w-full h-full text-center font-black text-lg bg-transparent outline-none p-0 ${hintCells.has(`${r}-${c}`) ? 'text-green-600' : 'text-black'}`,
              value: cellVal, onChange: e => handleInput(r, c, e.target.value),
              onFocus: () => !win && handleCellSelect(r, c),
              onKeyDown: e => handleKeyDown(e, r, c)
            })
          ]);
        }))
      ),
      React.createElement('aside', { className: 'w-full lg:flex-1 flex flex-col gap-3 min-h-[500px]' }, [
        
        // LEADERBOARD GLOBAL DARI DATABASE
        React.createElement('div', { className: 'p-3 bg-yellow-50 dark:bg-gray-800/80 card border-black dark:border-yellow-900/50 transition-colors' }, [
          React.createElement('h4', { className: 'text-[10px] font-black uppercase text-yellow-800 dark:text-yellow-400 mb-2 flex items-center gap-1' }, '🏆 Rekor Tercepat (Global)'),
          leaderboard.length === 0 ? React.createElement('p', { className: 'text-[9px] italic opacity-50' }, 'Belum ada rekor...') :
          leaderboard.map((e, idx) => React.createElement('div', { key: idx, className: 'flex justify-between text-[10px] font-bold border-b border-yellow-200 dark:border-gray-700 py-1 last:border-0' }, [
            React.createElement('span', null, `${idx + 1}. ${e.player_id || 'Anonim'}`), 
            React.createElement('span', { className: 'text-blue-600 dark:text-blue-400' }, fmtTime(e.completion_time))
          ]))
        ]),

        React.createElement('div', { className: 'p-4 bg-white dark:bg-gray-800 card border-black dark:border-gray-600 border-l-4 border-l-blue-600 shadow-sm' }, [
          React.createElement('h4', { className: 'text-[9px] font-black opacity-60 uppercase text-blue-600 dark:text-blue-400' }, 'SEDANG DIISI'),
          React.createElement('p', { className: 'font-black text-[13px] leading-tight mt-1.5' }, activeClue ? `${activeClue.number}. ${activeClue.clue}` : 'Klik kotak untuk petunjuk')
        ]),

        React.createElement('div', { className: 'p-3 bg-blue-50 dark:bg-gray-800 card border-black dark:border-gray-600' }, [
          React.createElement('h4', { className: 'text-[10px] font-black uppercase mb-1 text-blue-900 dark:text-blue-400' }, '👥 Room Activity'),
          otherPlayers.length === 0 && React.createElement('p', { className: 'text-[9px] italic opacity-50' }, 'Hanya Anda di room ini'),
          otherPlayers.map(p => React.createElement('p', { key: p.id, className: 'text-[9px] font-black animate-pulse text-blue-700 dark:text-blue-300' }, `• ${p.id} sedang aktif`))
        ]),

        // LIST CLUE
        React.createElement('div', { className: 'flex-1 overflow-y-auto space-y-3 p-1 custom-scrollbar border-t-2 border-black dark:border-gray-700 mt-2' }, 
          ['ACROSS', 'DOWN'].map(d => React.createElement('div', { key: d, className: 'bg-white dark:bg-gray-800/50 p-2 rounded border border-black/10 dark:border-gray-700' }, [
            React.createElement('h5', { className: 'text-[11px] font-black border-b border-black dark:border-gray-600 mb-2' }, d === 'ACROSS' ? 'MENDATAR' : 'MENURUN'),
            React.createElement('ul', { className: 'text-[10px] space-y-1.5' }, 
              puzzle.words.filter(w => w.direction === d).map(w => React.createElement('li', {
                key: w.number, onClick: () => { if(!win) { handleCellSelect(w.row, w.col); setDir(w.direction); } },
                className: `cursor-pointer p-2 rounded leading-tight transition-all border ${cursor.r === w.row && cursor.c === w.col && dir === d ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-black border-blue-500' : 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 border-transparent'}`
              }, `${w.number}. ${w.clue}`))
            )
          ]))
        )
      ])
    ]),

    win && React.createElement('div', { className: 'fixed inset-0 bg-black/90 flex items-center justify-center z-[600] p-4 backdrop-blur-md' }, 
      React.createElement('div', { className: 'text-center p-8 card bg-white dark:bg-gray-800 border-black dark:border-white shadow-2xl animate-in zoom-in duration-300 max-w-xs w-full' }, [
        React.createElement('div', { className: 'text-5xl mb-4' }, '🎉'),
        React.createElement('h2', { className: 'text-3xl font-black italic mb-2' }, 'ROOM SELESAI!'),
        React.createElement('p', { className: 'text-sm font-bold mb-6 opacity-70' }, `Teka-teki telah dipecahkan dalam waktu ${fmtTime(timer)}`),
        React.createElement('button', { onClick: handleExitGame, className: 'w-full py-4 bg-black dark:bg-white text-white dark:text-black font-black uppercase card text-xs hover:scale-95 transition-transform' }, 'KEMBALI KE MENU')
      ])
    )
  ]);
};

export default Player;