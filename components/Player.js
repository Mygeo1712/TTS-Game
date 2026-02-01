import React, { useState, useEffect, useRef } from 'react';
import { Direction } from '../generator.js';

const Player = ({ puzzle, onBack }) => {
  // --- STATE DASAR ---
  const [grid, setGrid] = useState([]);
  const [cursor, setCursor] = useState({ r: 0, c: 0 });
  const [dir, setDir] = useState(Direction.ACROSS);
  const [win, setWin] = useState(false);
  const [timer, setTimer] = useState(0);

  // --- STATE FITUR BARU (DARI PLAYER.HTML) ---
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showValidation, setShowValidation] = useState(false);
  const maxHints = 3;

  const inputRefs = useRef(new Map());

  // Inisialisasi Grid & Timer
  useEffect(() => {
    setGrid(Array.from({ length: puzzle.height }, () => Array(puzzle.width).fill('')));
    const first = puzzle.words[0];
    setCursor({ r: first.row, c: first.col });
    const interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [puzzle]);

  // Auto Focus saat cursor berubah
  useEffect(() => {
    const key = `${cursor.r}-${cursor.c}`;
    const targetEl = inputRefs.current.get(key);
    if (targetEl) {
      requestAnimationFrame(() => targetEl.focus());
    }
  }, [cursor]);

  // --- LOGIKA HELPER ---
  const getTargetLetter = (r, c) => {
    const w = puzzle.words.find(p => 
      p.direction === Direction.ACROSS 
        ? (p.row === r && c >= p.col && c < p.col + p.answer.length) 
        : (p.col === c && r >= p.row && r < p.row + p.answer.length)
    );
    if (!w) return null;
    return w.direction === Direction.ACROSS ? w.answer[c - w.col] : w.answer[r - w.row];
  };

  // --- FITUR: STATISTIK & PROGRESS ---
  const stats = (() => {
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

  // --- FITUR: INPUT & NAVIGASI KEYBOARD ---
  const handleInput = (r, c, v) => {
    if (win) return;
    const char = v.toUpperCase().slice(-1);
    if (char && !/[A-Z]/.test(char)) return;

    const nextGrid = [...grid];
    nextGrid[r][c] = char;
    setGrid(nextGrid);
    setShowValidation(false); // Sembunyikan merah/hijau saat mulai mengetik lagi

    if (char) {
      const nextR = dir === Direction.DOWN ? r + 1 : r;
      const nextC = dir === Direction.ACROSS ? c + 1 : c;
      if (getTargetLetter(nextR, nextC)) setCursor({ r: nextR, c: nextC });
    }

    if (stats.correct + (char === getTargetLetter(r,c) ? 1 : 0) === stats.total) setWin(true);
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
      if (getTargetLetter(nr, nc)) setCursor({ r: nr, c: nc });
    }
  };

  // --- FITUR: ACTION BUTTONS (HINT, CHECK, RESET) ---
  const useHint = () => {
    if (hintsUsed >= maxHints) return alert("Hint habis!");
    
    // Cari kotak kosong secara acak
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
    setCursor(randomCell);
  };

  const resetPuzzle = () => {
    if (confirm("Reset semua jawaban?")) {
      setGrid(Array.from({ length: puzzle.height }, () => Array(puzzle.width).fill('')));
      setTimer(0);
      setHintsUsed(0);
      setShowValidation(false);
    }
  };

  const fmtTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const activeClue = puzzle.words.find(w => w.direction === dir && (dir === Direction.ACROSS ? (w.row === cursor.r && cursor.c >= w.col && cursor.c < w.col + w.answer.length) : (w.col === cursor.c && cursor.r >= w.row && cursor.r < w.row + w.answer.length)));

  // --- RENDER ---
  return React.createElement('div', { className: 'space-y-6' }, [
    // Header & Stats
    React.createElement('div', { key: 'h', className: 'flex flex-wrap justify-between items-center gap-4 bg-white p-4 card' }, [
      React.createElement('div', null, [
        React.createElement('h2', { className: 'text-xl font-black uppercase' }, puzzle.title),
        React.createElement('div', { className: 'flex gap-4 mt-1' }, [
          React.createElement('span', { className: 'text-[10px] font-bold bg-black text-white px-2 py-0.5' }, `⏱️ ${fmtTime(timer)}`),
          React.createElement('span', { className: 'text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5' }, `💡 HINT: ${maxHints - hintsUsed}`),
        ])
      ]),
      React.createElement('div', { className: 'flex gap-2' }, [
        React.createElement('button', { onClick: useHint, className: 'px-3 py-1.5 bg-yellow-400 font-bold text-xs card' }, 'HINT'),
        React.createElement('button', { onClick: () => setShowValidation(true), className: 'px-3 py-1.5 bg-green-500 text-white font-bold text-xs card' }, 'CHECK'),
        React.createElement('button', { onClick: resetPuzzle, className: 'px-3 py-1.5 bg-gray-200 font-bold text-xs card' }, 'RESET'),
        React.createElement('button', { onClick: onBack, className: 'px-3 py-1.5 bg-black text-white font-bold text-xs card' }, 'KELUAR')
      ])
    ]),

    // Progress Bar
    React.createElement('div', { key: 'pb', className: 'w-full h-4 bg-gray-200 border-2 border-black overflow-hidden relative' }, 
      React.createElement('div', { 
        className: 'h-full bg-blue-500 transition-all duration-500 flex items-center justify-center text-[8px] font-black text-white',
        style: { width: `${stats.percent}%` }
      }, stats.percent > 5 ? `${stats.percent}%` : '')
    ),

    // Main Game Area
    React.createElement('div', { key: 'g', className: 'flex flex-col lg:flex-row gap-8' }, [
      // Grid
      React.createElement('div', { className: 'flex-1 flex justify-center' }, 
        React.createElement('div', { 
          className: 'inline-grid bg-gray-400 gap-px border-2 border-black p-1',
          style: { gridTemplateColumns: `repeat(${puzzle.width}, clamp(30px, 4vw, 45px))` }
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
            className: `grid-cell ${!target ? 'black' : ''} ${active ? 'active-cell' : ''} ${statusClass}`,
            onClick: () => target && setCursor({ r, c })
          }, [
            start && React.createElement('span', { key: 'n', className: 'grid-cell-number' }, start.number),
            target && React.createElement('input', {
              key: 'in',
              ref: (el) => { if (el) inputRefs.current.set(`${r}-${c}`, el); else inputRefs.current.delete(`${r}-${c}`); },
              value: grid[r]?.[c] || '', 
              onChange: e => handleInput(r, c, e.target.value),
              onKeyDown: e => handleKeyDown(e, r, c),
              onFocus: () => {
                setCursor({ r, c });
                const hasAcross = puzzle.words.some(w => w.direction === Direction.ACROSS && w.row === r && c >= w.col && c < w.col + w.answer.length);
                const hasDown = puzzle.words.some(w => w.direction === Direction.DOWN && w.col === c && r >= w.row && r < w.row + w.answer.length);
                if (hasAcross && !hasDown) setDir(Direction.ACROSS);
                if (hasDown && !hasAcross) setDir(Direction.DOWN);
              }
            })
          ]);
        }))
      ),

      // Sidebar Clues
      React.createElement('div', { className: 'w-full lg:w-80 space-y-4' }, [
        React.createElement('div', { className: 'p-4 bg-white card border-l-8 border-l-blue-600' }, [
          React.createElement('h4', { className: 'text-[10px] font-black uppercase opacity-40 mb-1' }, 'Sedang Diisi'),
          React.createElement('p', { className: 'font-bold text-sm' }, activeClue ? `${activeClue.number}. ${activeClue.clue}` : 'Pilih kotak di grid')
        ]),
        ['ACROSS', 'DOWN'].map(d => React.createElement('div', { key: d, className: 'bg-white p-3 card' }, [
          React.createElement('h5', { className: 'text-xs font-black border-b-2 border-black mb-2 pb-1' }, d === 'ACROSS' ? 'MENDATAR' : 'MENURUN'),
          React.createElement('ul', { className: 'text-[11px] space-y-2 max-h-48 overflow-y-auto' }, puzzle.words.filter(w => w.direction === d).map(w => React.createElement('li', {
            key: w.number, 
            className: `cursor-pointer p-1 rounded ${cursor.r === w.row && cursor.c === w.col && dir === d ? 'bg-blue-100 font-bold' : 'hover:bg-gray-50'}`,
            onClick: () => { setCursor({ r: w.row, c: w.col }); setDir(d); }
          }, `${w.number}. ${w.clue}`)))
        ]))
      ])
    ]),

    // Modal Kemenangan
    win && React.createElement('div', { className: 'fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4' }, 
      React.createElement('div', { className: 'text-center p-8 card bg-white max-w-sm w-full' }, [
        React.createElement('h2', { className: 'text-5xl font-black mb-4' }, 'LUAR BIASA!'),
        React.createElement('div', { className: 'space-y-2 mb-8' }, [
          React.createElement('p', { className: 'font-bold' }, `Waktu: ${fmtTime(timer)}`),
          React.createElement('p', { className: 'font-bold text-blue-600' }, `Hint Digunakan: ${hintsUsed}`),
        ]),
        React.createElement('button', { onClick: onBack, className: 'w-full py-4 bg-black text-white font-black uppercase card' }, 'KEMBALI KE MENU')
      ])
    )
  ]);
};

export default Player;