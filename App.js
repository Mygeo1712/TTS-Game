import React, { useState, useEffect } from 'react';
import AdminPanel from './components/AdminPanel.js';
import Player from './components/Player.js';

const App = () => {
  const [view, setView] = useState('Home');
  const [puzzles, setPuzzles] = useState([]);
  const [activePuzzle, setActivePuzzle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true');

  // --- FITUR LANJUTAN: LOGIN CREATOR ---
  const handleAdminAccess = () => {
    const isAuth = sessionStorage.getItem('isAdminAuthenticated');
    if (isAuth) {
      window.location.hash = 'admin';
    } else {
      const password = prompt("Masukkan Password Admin: \n(Petunjuk: Password default adalah memento2026)");
      if (password === "memento2026") { // Password default simulasi
        sessionStorage.setItem('isAdminAuthenticated', 'true');
        window.location.hash = 'admin';
      } else {
        alert("Password Salah! Akses Ditolak.");
      }
    }
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const fetchPuzzles = async () => {
    try {
      const res = await fetch('/api/puzzles');
      const data = await res.json();
      if (Array.isArray(data)) {
        setPuzzles(data);
      } else {
        setPuzzles([]);
      }
    } catch (e) {
      setPuzzles([]);
    }
  };

  useEffect(() => {
    fetchPuzzles();
    const handleHash = async () => {
      const hash = window.location.hash.substring(1);
      if (hash.startsWith('play/')) {
        const id = hash.split('/')[1];
        setLoading(true);
        try {
          const res = await fetch(`/api/puzzles/${id}`);
          const data = await res.json();
          setActivePuzzle(data);
          setView('Play');
        } catch (e) {
          alert("Gagal memuat puzzle");
          window.location.hash = '';
        }
        setLoading(false);
      } else if (hash === 'admin') {
        // Cek otentikasi saat hash berubah ke admin
        if (!sessionStorage.getItem('isAdminAuthenticated')) {
          window.location.hash = '';
          return;
        }
        setView('Admin');
      } else {
        setView('Home');
      }
    };
    window.addEventListener('hashchange', handleHash);
    handleHash();
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const save = async (p) => {
    try {
      await fetch('/api/puzzles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      });
      fetchPuzzles();
      window.location.hash = '';
    } catch (e) { alert("Error simpan"); }
  };

  return React.createElement('div', { 
    className: `min-h-screen pb-20 transition-colors duration-500 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-black'}` 
  }, [
    React.createElement('nav', { key: 'nav', className: 'bg-white dark:bg-gray-800 border-b-2 border-black dark:border-white sticky top-0 z-50 px-4 py-3' },
      React.createElement('div', { className: 'max-w-5xl mx-auto flex justify-between items-center' }, [
        React.createElement('h1', { key: 'l', className: 'text-xl font-black cursor-pointer dark:text-white', onClick: () => window.location.hash = '' }, 'TTS MASTER'),
        React.createElement('div', { className: 'flex gap-2' }, [
          React.createElement('button', { 
            onClick: () => setDarkMode(!darkMode), 
            className: 'p-1.5 border-2 border-black dark:border-white rounded-md hover:bg-yellow-400 transition-all' 
          }, darkMode ? '☀️' : '🌙'),
          React.createElement('button', { 
            onClick: handleAdminAccess, // Gunakan fungsi proteksi login
            className: 'bg-black text-white dark:bg-white dark:text-black px-4 py-1.5 font-bold text-xs card shadow-md' 
          }, 'BUAT TTS')
        ])
      ])
    ),
    React.createElement('main', { key: 'main', className: 'max-w-5xl mx-auto px-4 mt-10' }, [
      loading && React.createElement('p', { key: 'ld', className: 'text-center font-bold animate-pulse' }, 'MEMUAT...'),
      
      !loading && view === 'Home' && React.createElement('div', { key: 'h', className: 'animate-in fade-in slide-in-from-bottom-2 duration-500' }, [
        React.createElement('div', { className: 'flex justify-between items-center mb-10' }, [
          React.createElement('div', null, [
            React.createElement('h2', { className: 'text-4xl font-black' }, 'Pilih Teka-Teki'),
            React.createElement('p', { className: 'text-gray-500 dark:text-gray-400 font-medium mt-1' }, 'Tantang dirimu dengan berbagai koleksi TTS Master.')
          ]),
        ]),

        puzzles.length === 0 ?
          React.createElement('div', { className: 'flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-800 border-4 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl' }, [
            React.createElement('div', { className: 'text-6xl mb-4' }, '🧩'),
            React.createElement('h3', { className: 'text-xl font-bold text-gray-400' }, 'Belum ada teka-teki yang dibuat'),
            React.createElement('button', {
              onClick: handleAdminAccess,
              className: 'mt-6 bg-black text-white dark:bg-white dark:text-black px-8 py-3 font-black card transition-transform active:scale-95'
            }, 'MULAI BUAT SEKARANG')
          ])
          :
          React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8' },
            puzzles.map(p => React.createElement('div', { key: p.id, className: 'p-6 bg-white dark:bg-gray-800 card group hover:border-blue-600 transition-all hover:-translate-y-1' }, [
              React.createElement('div', { className: 'flex justify-between items-start mb-4' }, [
                React.createElement('span', { className: 'px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-black uppercase' }, p.difficulty || 'Medium'),
                React.createElement('span', { className: 'text-gray-300 font-bold text-xs' }, `#${p.id}`)
              ]),
              React.createElement('h3', { className: 'text-2xl font-black mb-6 leading-tight group-hover:text-blue-600 dark:text-white' }, p.title),
              React.createElement('div', { className: 'flex items-center gap-4 mb-6 text-xs font-bold text-gray-400' }, [
                React.createElement('span', null, `📏 ${p.width}x${p.height}`),
                React.createElement('span', null, `📅 ${new Date(p.created_at).toLocaleDateString('id-ID')}`)
              ]),
              React.createElement('button', {
                onClick: () => window.location.hash = `play/${p.id}`,
                className: 'w-full py-3 bg-black text-white dark:bg-white dark:text-black font-black text-sm uppercase card group-hover:bg-blue-600 transition-colors'
              }, 'Mainkan Sekarang')
            ]))
          )
      ]),
      !loading && view === 'Admin' && React.createElement(AdminPanel, { key: 'a', onSave: save, onCancel: () => window.location.hash = '' }),
      !loading && view === 'Play' && React.createElement(Player, { key: 'p', puzzle: activePuzzle, onBack: () => window.location.hash = '' })
    ])
  ]);
};

export default App;