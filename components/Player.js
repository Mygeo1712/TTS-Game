import React, { useState, useEffect, useRef } from 'react';
import { Direction } from '../generator.js';

const Player = ({ puzzle, onBack }) => {
  // --- STATE DASAR ---
  const [grid, setGrid] = useState([]);
  const [cursor, setCursor] = useState({ r: 0, c: 0 });
  const [dir, setDir] = useState(Direction.ACROSS);
  const [win, setWin] = useState(false);
  const [timer, setTimer] = useState(0);

  // --- STATE FITUR TAMBAHAN ---
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showValidation, setShowValidation] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const maxHints = 3;

  const inputRefs = useRef(new Map());
  const timerRef = useRef(null); // Ref untuk mengontrol stop timer

  // --- FITUR LANJUTAN: EXPORT PDF ---
  const exportToPDF = () => {
    window.print();
  };

  // --- FITUR LANJUTAN: LEADERBOARD LOKAL ---
  const updateLeaderboard = (finalTime) => {
    const currentBoard = JSON.parse(localStorage.getItem(`leaderboard-${puzzle.id}`) || '[]');
    const newEntry = { time: finalTime, date: new Date().toLocaleDateString() };
    const newBoard = [...currentBoard, newEntry].sort((a, b) => a.time - b.time).slice(0, 5);
    localStorage.setItem(`leaderboard-${puzzle.id}`, JSON.stringify(newBoard));
    setLeaderboard(newBoard);
  };

  useEffect(() => {
    if (!puzzle) return;
    
    // LOAD PROGRESS: Selalu muat dari nol jika tidak ada, namun sistem ini akan kita bersihkan saat user klik KELUAR
    const savedProgress = localStorage.getItem(`progress-${puzzle.id}`);
    if (savedProgress) {
      setGrid(JSON.parse(savedProgress));
    } else {
      setGrid(Array.from({ length: puzzle.height }, () => Array(puzzle.width).fill('')));
    }

    setLeaderboard(JSON.parse(localStorage.getItem(`leaderboard-${puzzle.id}`) || '[]'));

    const first = puzzle.words[0];
    if (first) {
      setCursor({ r: first.row, c: first.col });
      setDir(first.direction);
    }
    
    // TIMER START
    timerRef.current = setInterval(() => {
      setTimer(t => t + 1);
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [puzzle]);

  // Simpan progress ke storage selama permainan berlangsung
  useEffect(() => {
    if (grid.length > 0 && puzzle?.id && !win) {
      localStorage.setItem(`progress-${puzzle.id}`, JSON.stringify(grid));
    }
  }, [grid, puzzle, win]);

  useEffect(() => {
    const key = `${cursor.r}-${cursor.c}`;
    const targetEl = inputRefs.current.get(key);
    if (targetEl) {
      requestAnimationFrame(() => targetEl.focus());
    }
  }, [cursor]);

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
    setCursor({ r, c });
    const belongsToAcross = puzzle.words.some(w => w.direction === Direction.ACROSS && w.row === r && c >= w.col && c < w.col + w.answer.length);
    const belongsToDown = puzzle.words.some(w => w.direction === Direction.DOWN && w.col === c && r >= w.row && r < w.row + w.answer.length);

    if (belongsToDown && !belongsToAcross) {
      setDir(Direction.DOWN);
    } else if (belongsToAcross && !belongsToDown) {
      setDir(Direction.ACROSS);
    }
  };

  const handleInput = (r, c, v) => {
    if (win) return;
    const char = v.toUpperCase().slice(-1);
    if (char && !/[A-Z]/.test(char)) return;

    const nextGrid = [...grid];
    nextGrid[r][c] = char;
    setGrid(nextGrid);
    setShowValidation(false); 

    if (char) {
      const nextR = dir === Direction.DOWN ? r + 1 : r;
      const nextC = dir === Direction.ACROSS ? c + 1 : c;
      if (getTargetLetter(nextR, nextC)) setCursor({ r: nextR, c: nextC });
    }

    // CEK KEMENANGAN OTOMATIS
    let isWinNow = true;
    for(let i=0; i<puzzle.height; i++) {
      for(let j=0; j<puzzle.width; j++) {
        const t = getTargetLetter(i,j);
        if (t && nextGrid[i][j] !== t) isWinNow = false;
      }
    }
    
    if (isWinNow && !win) {
      handleFinishGame();
    }
  };

  // LOGIKA BERHENTI: Stop timer dan catat skor
  const handleFinishGame = () => {
    clearInterval(timerRef.current); // Stop waktu tepat saat selesai
    setWin(true);
    updateLeaderboard(timer);
    localStorage.removeItem(`progress-${puzzle.id}`); // Hapus progress karena sudah selesai
  };

  // LOGIKA KELUAR: Reset semua untuk sesi berikutnya
  const handleExit = () => {
    localStorage.removeItem(`progress-${puzzle.id}`);
    onBack();
  };

  const handleKeyDown = (e, r, c) => {
    if (e.key === 'Backspace' && !grid[r][c]) {
      const prevR = dir === Direction.DOWN ? r - 1 : r;
      const prevC = dir === Direction.ACROSS ? c - 1 : c;
      if (getTargetLetter(prevR, prevC)) setCursor({ r: prevR, c: prevC });
    } else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      let nr = r, nc = c;
      if (e.key === 'ArrowUp') nr--;
      if (e.key === 'ArrowDown') nr++;
      if (e.key === 'ArrowLeft') nc--;
      if (e.key === 'ArrowRight') nc++;
      if (getTargetLetter(nr, nc)) {
        handleCellSelect(nr, nc);
      }
    }
  };

  const useHint = () => {
    if (hintsUsed >= maxHints) return alert("Hint habis!");
    const emptyCells = [];
    for(let r=0; r<puzzle.height; r++) {
      for(let c=0; c<puzzle.width; c++) {
        if (getTargetLetter(r,c) && !grid[r][c]) emptyCells.push({r, c});
      }
    }
    if (emptyCells.length === 0) return alert("Semua kotak sudah terisi!");
    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const correctLetter = getTargetLetter(randomCell.r, randomCell.c);
    const nextGrid = [...grid];
    nextGrid[randomCell.r][randomCell.c] = correctLetter;
    setGrid(nextGrid);
    setHintsUsed(h => h + 1);
    handleCellSelect(randomCell.r, randomCell.c);
  };

  const resetPuzzle = () => {
    if (confirm("Reset semua jawaban?")) {
      setGrid(Array.from({ length: puzzle.height }, () => Array(puzzle.width).fill('')));
      setTimer(0);
      setHintsUsed(0);
      setShowValidation(false);
      localStorage.removeItem(`progress-${puzzle.id}`);
    }
  };

  const fmtTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const activeClue = puzzle.words.find(w => w.direction === dir && (dir === Direction.ACROSS ? (w.row === cursor.r && cursor.c >= w.col && cursor.c < w.col + w.answer.length) : (w.col === cursor.c && cursor.r >= w.row && cursor.r < w.row + w.answer.length)));

  return React.createElement('div', { className: 'space-y-4 max-h-screen flex flex-col p-2 animate-in fade-in duration-700 print:bg-white print:text-black' }, [
    // Header
    React.createElement('div', { key: 'h', className: 'flex flex-wrap justify-between items-center gap-2 bg-white dark:bg-gray-800 dark:border-white p-3 card shadow-md shrink-0 transition-colors print:shadow-none print:border-none' }, [
      React.createElement('div', null, [
        React.createElement('h2', { className: 'text-lg font-black uppercase dark:text-white' }, puzzle.title),
        React.createElement('div', { className: 'flex gap-2 mt-1 print:hidden' }, [
          React.createElement('span', { className: `text-[9px] font-bold ${win ? 'bg-green-600' : 'bg-black'} text-white px-2 py-0.5 rounded` }, `⏱️ ${fmtTime(timer)}`),
          React.createElement('span', { className: 'text-[9px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded' }, `💡 HINT: ${maxHints - hintsUsed}`),
        ])
      ]),
      React.createElement('div', { className: 'flex gap-1.5 print:hidden' }, [
        React.createElement('button', { onClick: exportToPDF, className: 'px-3 py-1 bg-blue-500 text-white font-black text-[10px] card' }, '📑 PDF'),
        React.createElement('button', { onClick: useHint, className: 'px-3 py-1 bg-yellow-400 font-black text-[10px] card hover:bg-yellow-300' }, 'HINT'),
        React.createElement('button', { onClick: () => setShowValidation(true), className: 'px-3 py-1 bg-green-500 text-white font-black text-[10px] card hover:bg-green-400' }, 'CHECK'),
        React.createElement('button', { onClick: handleExit, className: 'px-3 py-1 bg-black text-white font-black text-[10px] card hover:opacity-80' }, 'KELUAR')
      ])
    ]),

    // Progress Bar
    React.createElement('div', { key: 'pb', className: 'w-full h-3 bg-gray-200 dark:bg-gray-700 border border-black overflow-hidden shrink-0 print:hidden' }, 
      React.createElement('div', { 
        className: 'h-full bg-blue-500 transition-all duration-1000 ease-out flex items-center justify-center text-[7px] font-black text-white',
        style: { width: `${stats.percent}%` }
      }, stats.percent > 10 ? `${stats.percent}%` : '')
    ),

    // Main Game Area
    React.createElement('div', { key: 'g', className: 'flex flex-col lg:flex-row gap-4 overflow-hidden flex-1' }, [
      React.createElement('div', { className: 'flex-1 flex justify-center items-center bg-slate-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden p-2 transition-colors print:bg-white' }, 
        React.createElement('div', { 
          className: 'inline-grid bg-gray-900 gap-px border-2 border-black p-1 shadow-2xl print:shadow-none',
          style: { 
            gridTemplateColumns: `repeat(${puzzle.width}, minmax(15px, 1fr))`,
            width: '100%',
            maxWidth: `${puzzle.width * 40}px`,
            aspectRatio: `${puzzle.width} / ${puzzle.height}`
          }
        }, Array.from({ length: puzzle.height * puzzle.width }).map((_, i) => {
          const r = Math.floor(i / puzzle.width), c = i % puzzle.width;
          const target = getTargetLetter(r, c);
          const active = cursor.r === r && cursor.c === c;
          const start = puzzle.words.find(w => w.row === r && w.col === c);
          
          let statusClass = '';
          if (showValidation && grid[r][c]) {
            statusClass = grid[r][c] === target ? '!bg-green-400' : '!bg-red-400';
          }

          return React.createElement('div', { 
            key: i, 
            className: `grid-cell ${!target ? 'bg-gray-900' : 'bg-white'} ${active ? 'ring-2 ring-blue-500 z-10' : ''} ${statusClass} relative overflow-hidden transition-all duration-200`,
            style: { width: '100%', height: '100%' },
            onClick: () => target && handleCellSelect(r, c)
          }, [
            start && React.createElement('span', { key: 'n', className: 'grid-cell-number text-[6px] sm:text-[8px] font-black z-10 print:text-black' }, start.number),
            target && React.createElement('input', {
              key: 'in',
              ref: (el) => { if (el) inputRefs.current.set(`${r}-${c}`, el); else inputRefs.current.delete(`${r}-${c}`); },
              className: 'w-full h-full text-center font-black text-xs sm:text-base uppercase focus:outline-none bg-transparent p-0 dark:text-black print:text-black',
              style: { border: 'none' },
              value: grid[r]?.[c] || '', 
              onChange: e => handleInput(r, c, e.target.value),
              onKeyDown: e => handleKeyDown(e, r, c),
              onFocus: () => handleCellSelect(r, c)
            })
          ]);
        }))
      ),

      // Sidebar
      React.createElement('div', { className: 'w-full lg:w-64 flex flex-col gap-2 shrink-0 print:block' }, [
        leaderboard.length > 0 && React.createElement('div', { className: 'p-2 bg-yellow-50 dark:bg-yellow-900/20 card border-l-4 border-yellow-400 print:hidden' }, [
            React.createElement('h4', { className: 'text-[10px] font-black uppercase mb-1' }, '🏆 Skor Tercepat'),
            leaderboard.map((l, idx) => React.createElement('div', { key: idx, className: 'flex justify-between text-[9px] font-bold' }, [
              React.createElement('span', null, `${idx+1}. ${l.date}`),
              React.createElement('span', null, fmtTime(l.time))
            ]))
        ]),
        React.createElement('div', { className: 'p-3 bg-white dark:bg-gray-800 dark:text-white card border-l-4 border-l-blue-600 shrink-0 shadow-sm print:border-none' }, [
          React.createElement('h4', { className: 'text-[9px] font-black uppercase opacity-40 tracking-wider print:hidden' }, 'SEDANG DIISI'),
          React.createElement('p', { className: 'font-bold text-[11px] print:hidden' }, activeClue ? `${activeClue.number}. ${activeClue.clue}` : 'Klik kotak')
        ]),
        React.createElement('div', { className: 'flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar' }, 
          ['ACROSS', 'DOWN'].map(d => React.createElement('div', { key: d, className: 'bg-white dark:bg-gray-800 dark:text-white p-2 card print:shadow-none' }, [
            React.createElement('h5', { className: 'text-[9px] font-black border-b border-black dark:border-white mb-1 pb-0.5' }, d === 'ACROSS' ? 'MENDATAR' : 'MENURUN'),
            React.createElement('ul', { className: 'text-[9px] space-y-1' }, 
              puzzle.words.filter(w => w.direction === d).map(w => React.createElement('li', {
                key: w.number, 
                className: `cursor-pointer p-1 rounded ${cursor.r === w.row && cursor.c === w.col ? 'bg-blue-100 dark:bg-blue-900 font-bold' : ''}`,
                onClick: () => { handleCellSelect(w.row, w.col); setDir(d); }
              }, `${w.number}. ${w.clue}`))
            )
          ]))
        )
      ])
    ]),

    // Modal Kemenangan
    win && React.createElement('div', { className: 'fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm print:hidden' }, 
      React.createElement('div', { className: 'text-center p-6 card bg-white dark:bg-gray-800 dark:text-white max-w-xs w-full shadow-lg animate-bounce' }, [
        React.createElement('h2', { className: 'text-2xl font-black mb-2 italic' }, 'MENANG!'),
        React.createElement('p', { className: 'text-xs font-bold mb-4' }, `Rekor Waktu: ${fmtTime(timer)}`),
        React.createElement('button', { onClick: handleExit, className: 'w-full py-3 bg-black text-white font-black uppercase card text-xs' }, 'KEMBALI KE MENU')
      ])
    )
  ]);
};

export default Player;