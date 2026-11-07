// =====================================
// Level generator
// =====================================
// Builds a fresh set of levels every time it is called. Each level has two normal
// waves and a boss wave. Difficulty rises with the level number, because the words
// get longer. No word is used twice in the same run.
//
// The generator is seedable: the same seed always produces the same levels, which
// is handy for testing and for reproducing a player's session.

import { WORDS } from './wordBank.js';

export const MIN_WORD_LENGTH = 4;
export const MAX_WORD_LENGTH = 16;
export const MAX_LEVELS = 10;
export const DEFAULT_LEVELS = 10;

// Small, fast, good-enough seeded random number generator.
export function createRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildBuckets(words) {
  const buckets = new Map();
  for (const raw of new Set(words)) {
    const word = String(raw).toLowerCase();
    if (!/^[a-z]+$/.test(word)) continue; // skip anything that cannot be spelled letter by letter
    if (word.length < MIN_WORD_LENGTH || word.length > MAX_WORD_LENGTH) continue;
    if (!buckets.has(word.length)) buckets.set(word.length, []);
    buckets.get(word.length).push(word);
  }
  return buckets;
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * @param {object}   [options]
 * @param {number}   [options.count=10]   how many levels (1-10)
 * @param {number}   [options.seed]       any integer; random when omitted
 * @param {string[]} [options.words]      custom word list (used by the tests)
 * @returns {{ seed:number, generated_at:string, levels:Array }}
 */
export function generateLevels({ count = DEFAULT_LEVELS, seed, words = WORDS } = {}) {
  const levelCount = clamp(Math.floor(Number(count)) || DEFAULT_LEVELS, 1, MAX_LEVELS);
  const usedSeed = Number.isFinite(Number(seed))
    ? Math.floor(Number(seed)) >>> 0
    : Math.floor(Math.random() * 0xffffffff) >>> 0;

  const random = createRandom(usedSeed);
  const buckets = buildBuckets(words);
  const used = new Set();

  // Pick an unused word of the requested length. If that length has run out,
  // fall back to the nearest length that still has words available.
  function pickWord(length) {
    for (let distance = 0; distance <= MAX_WORD_LENGTH; distance++) {
      const candidates = distance === 0 ? [length] : random() < 0.5 ? [length + distance, length - distance] : [length - distance, length + distance];
      for (const candidateLength of candidates) {
        const pool = (buckets.get(candidateLength) || []).filter((w) => !used.has(w));
        if (pool.length > 0) {
          const word = pool[Math.floor(random() * pool.length)];
          used.add(word);
          return word;
        }
      }
    }
    throw new Error('Word bank is too small to build the requested levels');
  }

  const levels = [];
  for (let i = 0; i < levelCount; i++) {
    // Base length grows by one letter per level: 4, 5, 6 ... 13.
    const base = Math.min(MIN_WORD_LENGTH + i, MAX_WORD_LENGTH - 3);
    const length1 = Math.min(base + (random() < 0.35 ? 1 : 0), MAX_WORD_LENGTH - 2);
    const length2 = Math.min(Math.max(length1, base + 1) + (random() < 0.35 ? 1 : 0), MAX_WORD_LENGTH - 1);
    const lengthBoss = Math.min(Math.max(length2 + 1, 6 + i), MAX_WORD_LENGTH);

    levels.push({
      id: i + 1,
      name: `LEVEL ${i + 1}`,
      waves: [
        { id: 1, name: 'FIRST WAVE', word: pickWord(length1), isBoss: false },
        { id: 2, name: 'SECOND WAVE', word: pickWord(length2), isBoss: false },
        { id: 3, name: 'BOSS WAVE', word: pickWord(lengthBoss), isBoss: true }
      ]
    });
  }

  return { seed: usedSeed, generated_at: new Date().toISOString(), levels };
}
