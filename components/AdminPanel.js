import React, { useState, useRef, useEffect } from 'react';
import { generateCrossword, Direction } from '../generator.js';

const AdminPanel = ({ onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState(Array(5).fill(0).map(() => ({ answer: '', clue: '' })));
  const [preview, setPreview] = useState(null);
  const inputRefs = useRef({});

  // --- FITUR LANJUTAN: SIMPAN DRAF OTOMATIS ---
  useEffect(() => {
    const savedDraft = localStorage.getItem('tts-admin-draft');
    if (savedDraft) {
      const { title: t, rows: r } = JSON.parse(savedDraft);
      setTitle(t);
      setRows(r);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('tts-admin-draft', JSON.stringify({ title, rows }));
  }, [title, rows]);

  const update = (i, f, v) => {
    const n = [...rows];
    n[i][f] = v;
    setRows(n);
  };

  const removeRow = (index) => {
    if (rows.length <= 1) return;
    const n = rows.filter((_, i) => i !== index);
    setRows(n);
  };

  const handleKeyDown = (e, type, index) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (type === 'answer') {
        inputRefs.current[`clue-${index}`]?.focus();
      } else if (type === 'clue') {
        const nextIndex = index + 1;
        if (rows[nextIndex]) {
          inputRefs.current[`answer-${nextIndex}`]?.focus();
        } else {
          const newRows = [...rows, { answer: '', clue: '' }];
          setRows(newRows);
          setTimeout(() => {
            inputRefs.current[`answer-${nextIndex}`]?.focus();
          }, 10);
        }
      }
    }
  };

  const handleGenerate = () => {
    const valid = rows.filter(r => r.answer.trim() && r.clue.trim());
    if (valid.length < 5) return alert("Minimal 5 kata.");

    let bestResult = null;
    for (let i = 0; i < 100; i++) {
      const attempt = generateCrossword(valid);
      if (attempt && (!bestResult || attempt.placed.length > bestResult.placed.length)) {
        bestResult = attempt;
      }
    }

    if (!bestResult) return alert("Gagal menyusun grid. Coba ganti kata.");

    let n = 1;
    const posMap = {};
    const numbered = bestResult.placed.map(p => {
      const k = `${p.row},${p.col}`;
      if (!posMap[k]) posMap[k] = n++;
      return { ...p, number: posMap[k] };
    });
    setPreview({ ...bestResult, placed: numbered });
  };

  const handlePublish = () => {
    onSave({ title: title || 'Tanpa Judul', width: preview.width, height: preview.height, difficulty: 'Medium', placed: preview.placed });
    localStorage.removeItem('tts-admin-draft'); // Bersihkan draf setelah publish
  };

  return React.createElement('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-10 max-h-[calc(100vh-120px)]' }, [
    // BAGIAN KIRI: INPUT FORM
    React.createElement('div', { key: 'f', className: 'space-y-4 overflow-y-auto pr-2' }, [
      React.createElement('h2', { className: 'text-2xl font-black' }, 'Admin / Creator'),
      React.createElement('input', { 
        placeholder: 'Judul TTS...', value: title, onChange: e => setTitle(e.target.value),
        className: 'w-full p-3 border-2 border-black font-bold card outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:text-white'
      }),
      React.createElement('div', { className: 'space-y-2' }, rows.map((r, i) => 
        React.createElement('div', { key: i, className: 'flex gap-2 group' }, [
          React.createElement('input', { 
            ref: el => inputRefs.current[`answer-${i}`] = el,
            placeholder: 'KATA', value: r.answer, 
            onChange: e => update(i, 'answer', e.target.value),
            onKeyDown: e => handleKeyDown(e, 'answer', i),
            className: 'w-28 p-2 border-2 border-black font-bold uppercase focus:bg-yellow-50 outline-none text-sm dark:bg-gray-700'
          }),
          React.createElement('input', { 
            ref: el => inputRefs.current[`clue-${i}`] = el,
            placeholder: 'Petunjuk/Clue...', value: r.clue, 
            onChange: e => update(i, 'clue', e.target.value),
            onKeyDown: e => handleKeyDown(e, 'clue', i),
            className: 'flex-1 p-2 border-2 border-black focus:bg-blue-50 outline-none text-sm dark:bg-gray-700'
          }),
          React.createElement('button', {
            key: `del-${i}`,
            onClick: () => removeRow(i),
            className: 'px-3 text-red-500 font-bold border-2 border-transparent hover:border-red-500'
          }, '✕')
        ])
      )),
      React.createElement('div', { className: 'flex gap-2 sticky bottom-0 bg-white dark:bg-gray-900 py-2' }, [
        React.createElement('button', { 
          onClick: () => setRows([...rows, { answer: '', clue: '' }]), 
          className: 'px-4 py-2 border-2 border-black font-bold hover:bg-gray-100 text-sm dark:text-white' 
        }, '+ Baris'),
        React.createElement('button', { 
          onClick: handleGenerate, 
          className: 'flex-1 py-2 bg-black text-white font-bold card active:translate-y-0.5' 
        }, 'GENERATE GRID')
      ])
    ]),

    // BAGIAN KANAN: PREVIEW GRID
    React.createElement('div', { key: 'p', className: 'bg-white dark:bg-gray-800 p-4 card flex flex-col items-center justify-start overflow-auto min-h-[400px]' }, 
      preview ? [
        React.createElement('div', { 
          key: 'g', 
          className: 'inline-grid bg-black gap-px border-2 border-black shadow-xl mb-6',
          style: { 
            gridTemplateColumns: `repeat(${preview.width}, minmax(25px, 40px))`,
            gridAutoRows: 'minmax(25px, 40px)',
            width: 'fit-content'
          }
        }, Array.from({ length: preview.height * preview.width }).map((_, i) => {
          const r = Math.floor(i / preview.width), c = i % preview.width;
          const word = preview.placed.find(p => p.direction === Direction.ACROSS ? (p.row === r && c >= p.col && c < p.col + p.answer.length) : (p.col === c && r >= p.row && r < p.row + p.answer.length));
          const char = word ? (word.direction === Direction.ACROSS ? word.answer[c - word.col] : word.answer[r - word.row]) : null;
          const start = preview.placed.find(p => p.row === r && p.col === c);
          
          return React.createElement('div', { 
            key: `cell-${i}`, 
            className: `relative flex items-center justify-center font-black uppercase ${!char ? 'bg-black' : 'bg-white text-black'}`,
            style: { width: '100%', height: '100%' }
          }, [
            start && React.createElement('span', { key: 'num', className: 'absolute top-0.5 left-0.5 text-[8px] leading-none z-10' }, start.number),
            char && React.createElement('span', { className: 'text-sm sm:text-base' }, char)
          ]);
        })),
        React.createElement('button', { 
          onClick: handlePublish,
          className: 'w-full py-3 bg-green-600 text-white font-black card hover:bg-green-700 transition-colors shrink-0'
        }, 'SIMPAN KE DATABASE')
      ] : React.createElement('p', { className: 'text-center opacity-30 italic mt-20 dark:text-white' }, 'Klik Generate untuk melihat hasil')
    )
  ]);
};

export default AdminPanel;