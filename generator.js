export const Direction = { ACROSS: 'ACROSS', DOWN: 'DOWN' };

/**
 * CORE ALGORITHM: CROSSWORD GENERATOR (Iterative Fitting)
 * Algoritma ini dirancang untuk menyusun kata secara otomatis dengan 
 * mengoptimalkan kepadatan grid melalui percobaan berulang (100 iterasi).
 */
export const generateCrossword = (inputWords) => {
  // Step 1: Pre-processing & Sorting
  // Mengurutkan kata dari yang terpanjang untuk memudahkan penempatan awal (anchor)
  // dan membersihkan input dari spasi serta memastikan uppercase.
  const words = [...inputWords]
    .sort((a, b) => b.answer.length - a.answer.length)
    .map(w => ({ ...w, answer: w.answer.toUpperCase().replace(/\s/g, '') }));

  let bestResult = null;
  let maxPlaced = -1;

  // Step 2: Iterative Optimization
  // Melakukan 100 percobaan penempatan untuk mendapatkan variasi grid terbaik (paling padat).
  for (let attempt = 0; attempt < 100; attempt++) {
    const placed = [];
    const grid = new Map(); // Menggunakan Map untuk tracking huruf pada koordinat (row, col)

    // Sub-fungsi untuk memvalidasi apakah sebuah kata layak ditempatkan di posisi tertentu
    const isCellValid = (word, r, c, dir) => {
      for (let i = 0; i < word.length; i++) {
        const currR = dir === Direction.ACROSS ? r : r + i;
        const currC = dir === Direction.ACROSS ? c + i : c;
        const char = word[i];

        // Validasi 1: Cek tabrakan huruf yang berbeda pada sel yang sama
        const existing = grid.get(`${currR},${currC}`);
        if (existing && existing !== char) return false;

        // Validasi 2: Strict Neighbor Rule (Aturan Tetangga Ketat)
        // Mencegah kata menempel di samping kata lain jika tidak membentuk persimpangan sah
        if (!existing) {
          const neighbors = [
            [currR - 1, currC], [currR + 1, currC], [currR, currC - 1], [currR, currC + 1]
          ];
          for (const [nr, nc] of neighbors) {
            // Abaikan pengecekan jika tetangga adalah bagian dari urutan kata itu sendiri
            if (dir === Direction.ACROSS && nr === currR && (nc === c + i - 1 || nc === c + i + 1)) continue;
            if (dir === Direction.DOWN && nc === currC && (nr === r + i - 1 || nr === r + i + 1)) continue;
            if (grid.has(`${nr},${nc}`)) return false;
          }
          
          // Validasi 3: Cek ujung kata (harus kosong agar tidak menyambung menjadi kata baru)
          if (i === 0) {
            const prevR = dir === Direction.ACROSS ? r : r - 1;
            const prevC = dir === Direction.ACROSS ? c - 1 : c;
            if (grid.has(`${prevR},${prevC}`)) return false;
          }
          if (i === word.length - 1) {
            const nextR = dir === Direction.ACROSS ? r : r + i + 1;
            const nextC = dir === Direction.ACROSS ? c + i + 1 : c;
            if (grid.has(`${nextR},${nextC}`)) return false;
          }
        }
      }
      return true;
    };

    // Sub-fungsi untuk mendaftarkan kata ke dalam grid
    const place = (w, r, c, dir) => {
      placed.push({ ...w, row: r, col: c, direction: dir });
      for (let i = 0; i < w.answer.length; i++) {
        const currR = dir === Direction.ACROSS ? r : r + i;
        const currC = dir === Direction.ACROSS ? c + i : c;
        grid.set(`${currR},${currC}`, w.answer[i]);
      }
    };

    // Step 3: Randomized Selection
    // Pada iterasi pertama, gunakan urutan asli. Iterasi selanjutnya diacak (Shuffle)
    // agar algoritma mencoba berbagai kombinasi persimpangan.
    const wordsToProcess = attempt === 0 ? words : [...words].sort(() => Math.random() - 0.5);
    
    // Menempatkan kata pertama sebagai titik pusat (0,0)
    place(wordsToProcess[0], 0, 0, Direction.ACROSS);

    // Step 4: Collision-Based Fitting
    // Mencari kecocokan huruf antara kata yang belum ditempatkan dengan kata yang sudah ada di grid.
    for (let i = 1; i < wordsToProcess.length; i++) {
      const current = wordsToProcess[i];
      let found = false;
      for (const p of placed) {
        if (found) break;
        for (let j = 0; j < p.answer.length; j++) {
          if (found) break;
          for (let k = 0; k < current.answer.length; k++) {
            // Jika ditemukan huruf yang sama, coba buat persimpangan tegak lurus
            if (p.answer[j] === current.answer[k]) {
              const newDir = p.direction === Direction.ACROSS ? Direction.DOWN : Direction.ACROSS;
              const newR = newDir === Direction.ACROSS ? p.row + j : p.row - k;
              const newC = newDir === Direction.ACROSS ? p.col - k : p.col + j;
              
              if (isCellValid(current.answer, newR, newC, newDir)) {
                place(current, newR, newC, newDir);
                found = true;
                break;
              }
            }
          }
        }
      }
    }

    // Step 5: Result Evaluation
    // Jika iterasi ini berhasil menempatkan kata lebih banyak dari sebelumnya, simpan sebagai hasil terbaik.
    if (placed.length > maxPlaced) {
      maxPlaced = placed.length;
      let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
      
      // Hitung dimensi akhir grid (Boundary Box)
      placed.forEach(p => {
        minR = Math.min(minR, p.row);
        minC = Math.min(minC, p.col);
        maxR = Math.max(maxR, p.direction === Direction.DOWN ? p.row + p.answer.length - 1 : p.row);
        maxC = Math.max(maxC, p.direction === Direction.ACROSS ? p.col + p.answer.length - 1 : p.col);
      });

      // Step 6: Normalization & Margin
      // Menormalkan koordinat agar selalu positif dan memberikan margin 1 sel di sekeliling grid.
      const margin = 1; 
      bestResult = {
        placed: placed.map(p => ({ 
          ...p, 
          row: p.row - minR + margin, 
          col: p.col - minC + margin 
        })),
        width: maxC - minC + 1 + (margin * 2),
        height: maxR - minR + 1 + (margin * 2)
      };
    }
  }
  return bestResult;
};