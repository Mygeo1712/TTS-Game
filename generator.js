
export const Direction = { ACROSS: 'ACROSS', DOWN: 'DOWN' };

/**
 * Algoritma Crossword:
 * 1. Mengurutkan kata dari yang terpanjang.
 * 2. Mencoba menempatkan kata dengan mencari persimpangan huruf yang sama.
 * 3. Validasi aturan ketat (tidak boleh ada kata menempel tanpa persimpangan).
 */
export const generateCrossword = (inputWords) => {
  const words = [...inputWords]
    .sort((a, b) => b.answer.length - a.answer.length)
    .map(w => ({ ...w, answer: w.answer.toUpperCase().replace(/\s/g, '') }));

  let bestResult = null;
  let maxPlaced = -1;

  // Coba 20 iterasi untuk hasil terbaik
  for (let attempt = 0; attempt < 20; attempt++) {
    const placed = [];
    const grid = new Map();

    const isCellValid = (word, r, c, dir) => {
      for (let i = 0; i < word.length; i++) {
        const currR = dir === Direction.ACROSS ? r : r + i;
        const currC = dir === Direction.ACROSS ? c + i : c;
        const char = word[i];

        const existing = grid.get(`${currR},${currC}`);
        if (existing && existing !== char) return false;

        if (!existing) {
          const neighbors = [
            [currR - 1, currC], [currR + 1, currC], [currR, currC - 1], [currR, currC + 1]
          ];
          for (const [nr, nc] of neighbors) {
            if (dir === Direction.ACROSS && nr === currR && (nc === c + i - 1 || nc === c + i + 1)) continue;
            if (dir === Direction.DOWN && nc === currC && (nr === r + i - 1 || nr === r + i + 1)) continue;
            if (grid.has(`${nr},${nc}`)) return false;
          }
          
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

    const place = (w, r, c, dir) => {
      placed.push({ ...w, row: r, col: c, direction: dir });
      for (let i = 0; i < w.answer.length; i++) {
        const currR = dir === Direction.ACROSS ? r : r + i;
        const currC = dir === Direction.ACROSS ? c + i : c;
        grid.set(`${currR},${currC}`, w.answer[i]);
      }
    };

    place(words[0], 0, 0, Direction.ACROSS);

    for (let i = 1; i < words.length; i++) {
      const current = words[i];
      let found = false;
      for (const p of placed) {
        if (found) break;
        for (let j = 0; j < p.answer.length; j++) {
          if (found) break;
          for (let k = 0; k < current.answer.length; k++) {
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

    if (placed.length > maxPlaced) {
      maxPlaced = placed.length;
      let minR = 0, maxR = 0, minC = 0, maxC = 0;
      placed.forEach(p => {
        minR = Math.min(minR, p.row);
        minC = Math.min(minC, p.col);
        maxR = Math.max(maxR, p.direction === Direction.DOWN ? p.row + p.answer.length - 1 : p.row);
        maxC = Math.max(maxC, p.direction === Direction.ACROSS ? p.col + p.answer.length - 1 : p.col);
      });
      bestResult = {
        placed: placed.map(p => ({ ...p, row: p.row - minR, col: p.col - minC })),
        width: maxC - minC + 1,
        height: maxR - minR + 1
      };
    }
  }
  return bestResult;
};
