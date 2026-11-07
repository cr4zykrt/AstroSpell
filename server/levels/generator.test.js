// Run with:  npm test   (from the server folder)
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLevels, MAX_WORD_LENGTH, MIN_WORD_LENGTH } from './generator.js';
import { WORDS } from './wordBank.js';

test('word bank is clean and has enough words for every length', () => {
  const byLength = new Map();
  for (const word of WORDS) {
    assert.match(word, /^[a-z]+$/, `"${word}" must only contain a-z`);
    byLength.set(word.length, (byLength.get(word.length) || 0) + 1);
  }
  assert.equal(new Set(WORDS).size, WORDS.length, 'word bank has duplicates');
  for (let length = MIN_WORD_LENGTH; length <= MAX_WORD_LENGTH; length++) {
    assert.ok((byLength.get(length) || 0) >= 5, `need at least 5 words with ${length} letters`);
  }
});

test('returns 10 levels with two normal waves and one boss wave each', () => {
  const { levels } = generateLevels({ seed: 1 });
  assert.equal(levels.length, 10);
  levels.forEach((level, i) => {
    assert.equal(level.id, i + 1);
    assert.equal(level.name, `LEVEL ${i + 1}`);
    assert.deepEqual(level.waves.map((w) => w.id), [1, 2, 3]);
    assert.deepEqual(level.waves.map((w) => w.isBoss), [false, false, true]);
    level.waves.forEach((w) => assert.match(w.word, /^[a-z]+$/));
  });
});

test('no word is repeated inside one run', () => {
  for (let seed = 0; seed < 200; seed++) {
    const words = generateLevels({ seed }).levels.flatMap((l) => l.waves.map((w) => w.word));
    assert.equal(new Set(words).size, words.length, `repeat found with seed ${seed}`);
  }
});

test('boss word is always longer than the first wave, and difficulty rises', () => {
  for (let seed = 0; seed < 200; seed++) {
    const { levels } = generateLevels({ seed });
    levels.forEach((l) => assert.ok(l.waves[2].word.length > l.waves[0].word.length, `seed ${seed} ${l.name}`));
    const first = levels[0].waves[2].word.length;
    const last = levels[levels.length - 1].waves[2].word.length;
    assert.ok(last > first + 5, `last boss (${last}) should be much longer than first boss (${first})`);
  }
});

test('the same seed gives the same levels; different seeds give different levels', () => {
  const a = generateLevels({ seed: 42 }).levels;
  const b = generateLevels({ seed: 42 }).levels;
  const c = generateLevels({ seed: 43 }).levels;
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('visits without a seed get different levels', () => {
  const runs = new Set();
  for (let i = 0; i < 20; i++) runs.add(JSON.stringify(generateLevels().levels));
  assert.ok(runs.size >= 19, 'levels should be different on (almost) every visit');
});

test('count is clamped to 1-10 and bad input falls back safely', () => {
  assert.equal(generateLevels({ seed: 1, count: 3 }).levels.length, 3);
  assert.equal(generateLevels({ seed: 1, count: 999 }).levels.length, 10);
  assert.equal(generateLevels({ seed: 1, count: 0 }).levels.length, 10); // 0 is falsy -> default
  assert.equal(generateLevels({ seed: 1, count: 'abc' }).levels.length, 10);
});

test('throws a clear error if the word bank is too small', () => {
  assert.throws(() => generateLevels({ seed: 1, words: ['star', 'moon'] }), /too small/);
});
