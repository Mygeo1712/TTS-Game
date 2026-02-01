
import React, { useState } from 'react';
import { generateCrossword, Direction } from '../generator.js';

const AdminPanel = ({ onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState(Array(5).fill(0).map(() => ({ answer: '', clue: '' })));
  const [preview, setPreview] = useState(null);

  const update = (i, f, v) => {
    const n = [...rows];
    n[i][f] = v;
    setRows(n);
  };

  const handleGenerate = () => {
    const valid = rows.filter(r => r.answer.trim() && r.clue.trim());
    if (valid.length < 5) return alert("Minimal 5 kata.");
    const result = generateCrossword(valid);
    if (!result) return alert("Gagal menyusun grid. Coba ganti kata.");

    const sorted = [...result.placed].sort((a,b) => a.row === b.row ? a.col - b.col : a.row - b.row);
    let n = 1;
    const posMap = {};
    const numbered = result.placed.map(p => {
      const k = `${p.row},${p.col}`;
      if (!posMap[k]) posMap[k] = n++;
      return { ...p, number: posMap[k] };
    });
    setPreview({ ...result, placed: numbered });
  };

  return React.createElement('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-10' }, [
    React.createElement('div', { key: 'f', className: 'space-y-6' }, [
      React.createElement('h2', { className: 'text-2xl font-black' }, 'Admin / Creator'),
      React.createElement('input', { 
        placeholder: 'Judul...', value: title, onChange: e => setTitle(e.target.value),
        className: 'w-full p-3 border-2 border-black font-bold card'
      }),
      React.createElement('div', { className: 'space-y-2' }, rows.map((r, i) => React.createElement('div', { key: i, className: 'flex gap-2' }, [
        React.createElement('input', { 
          placeholder: 'KATA', value: r.answer, onChange: e => update(i, 'answer', e.target.value),
          className: 'w-24 p-2 border-2 border-black font-bold uppercase'
        }),
        React.createElement('input', { 
          placeholder: 'Clue...', value: r.clue, onChange: e => update(i, 'clue', e.target.value),
          className: 'flex-1 p-2 border-2 border-black'
        })
      ]))),
      React.createElement('div', { className: 'flex gap-2' }, [
        React.createElement('button', { onClick: () => setRows([...rows, { answer: '', clue: '' }]), className: 'px-4 py-2 border-2 border-black font-bold' }, '+ Row'),
        React.createElement('button', { onClick: handleGenerate, className: 'flex-1 py-2 bg-black text-white font-bold card' }, 'GENERATE')
      ])
    ]),
    React.createElement('div', { key: 'p', className: 'bg-white p-6 card overflow-auto' }, 
      preview ? [
        React.createElement('div', { 
          key: 'g', className: 'inline-grid bg-black gap-px border-2 border-black mb-6',
          style: { gridTemplateColumns: `repeat(${preview.width}, 30px)` }
        }, Array.from({ length: preview.height * preview.width }).map((_, i) => {
          const r = Math.floor(i / preview.width), c = i % preview.width;
          const w = preview.placed.find(p => p.direction === Direction.ACROSS ? (p.row === r && c >= p.col && c < p.col + p.answer.length) : (p.col === c && r >= p.row && r < p.row + p.answer.length));
          const ch = w ? (w.direction === Direction.ACROSS ? w.answer[c - w.col] : w.answer[r - w.row]) : null;
          const s = preview.placed.find(p => p.row === r && p.col === c);
          return React.createElement('div', { key: i, className: `grid-cell ${!ch ? 'black' : ''}` }, [
            s && React.createElement('span', { key: 'n', className: 'grid-cell-number' }, s.number), ch
          ]);
        })),
        React.createElement('button', { 
          onClick: () => onSave({ title: title || 'Tanpa Judul', width: preview.width, height: preview.height, difficulty: 'Medium', placed: preview.placed }),
          className: 'w-full py-3 bg-green-600 text-white font-black card'
        }, 'PUBLISH')
      ] : React.createElement('p', { className: 'text-center py-20 opacity-30 italic' }, 'Preview muncul di sini')
    )
  ]);
};

export default AdminPanel;
