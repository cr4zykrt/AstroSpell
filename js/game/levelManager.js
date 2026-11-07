// =====================================
// Level Manager
// =====================================
// Levels are NOT stored in the game any more. They come from the server
// (GET /api/levels), which builds a different set every time.

window.levelManager = (function () {
  let levelsData = null;
  let currentLevelId = 1;
  let currentWaveId = 1;
  let pending = null; // a refresh that is still running

  function validate(data) {
    const ok =
      data &&
      Array.isArray(data.levels) &&
      data.levels.length > 0 &&
      data.levels.every(
        (level) =>
          Number.isInteger(level.id) &&
          Array.isArray(level.waves) &&
          level.waves.length > 0 &&
          level.waves.every((wave) => Number.isInteger(wave.id) && typeof wave.word === 'string' && /^[a-z]+$/i.test(wave.word))
      );
    if (!ok) throw new Error('The server sent levels in an unexpected format');
    return data;
  }

  async function fetchLevels() {
    // Wait for the session so the server can remember which levels this player got.
    try { await window.sessionReady; } catch (e) { /* logging is optional */ }
    const sessionId = window.AstroSpellSessionId;
    const query = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : '';
    return validate(await window.apiFetch(`/levels${query}`, { cache: 'no-store' }));
  }

  // First load. Throws if the server cannot be reached (the loading screen retries).
  async function loadLevels() {
    if (levelsData) return levelsData;
    levelsData = await fetchLevels();
    return levelsData;
  }

  // Fetch a brand-new set of levels and start again from level 1.
  // If the server cannot be reached the current levels are kept, so the player can still play.
  function resetRun() {
    currentLevelId = 1;
    currentWaveId = 1;
    pending = fetchLevels()
      .then((fresh) => { levelsData = fresh; return true; })
      .catch((error) => { console.warn('Could not refresh levels, reusing the current ones:', error.message); return false; })
      .finally(() => { pending = null; });
    return pending;
  }

  // Resolves once any refresh has finished (so the game never starts with half-swapped levels).
  function whenReady() {
    return pending || Promise.resolve(true);
  }

  function getCurrentLevel() {
    if (!levelsData) return null;
    return levelsData.levels.find((l) => l.id === currentLevelId) || null;
  }

  function getCurrentWave() {
    const level = getCurrentLevel();
    if (!level) return null;
    return level.waves.find((w) => w.id === currentWaveId) || null;
  }

  function getCurrentWord() {
    const wave = getCurrentWave();
    return wave ? wave.word.toUpperCase() : null;
  }

  function getWaveName() {
    const wave = getCurrentWave();
    if (!wave) return null;
    return wave.isBoss ? 'BOSS WAVE' : wave.name;
  }

  function getLevelName() {
    const level = getCurrentLevel();
    return level ? level.name : null;
  }

  function setLevel(levelId, waveId = 1) {
    currentLevelId = levelId;
    currentWaveId = waveId;
  }

  function nextWave() {
    const level = getCurrentLevel();
    if (level && currentWaveId < level.waves.length) {
      currentWaveId++;
      return true;
    }
    return false;
  }

  function nextLevel() {
    if (!levelsData) return false;
    const index = levelsData.levels.findIndex((l) => l.id === currentLevelId);
    if (index >= 0 && index < levelsData.levels.length - 1) {
      currentLevelId = levelsData.levels[index + 1].id;
      currentWaveId = 1;
      return true;
    }
    return false;
  }

  function hasNextLevel() {
    if (!levelsData) return false;
    const index = levelsData.levels.findIndex((l) => l.id === currentLevelId);
    return index >= 0 && index < levelsData.levels.length - 1;
  }

  return {
    loadLevels,
    resetRun,
    whenReady,
    getCurrentLevel,
    getCurrentWave,
    getCurrentWord,
    getWaveName,
    getLevelName,
    setLevel,
    nextWave,
    nextLevel,
    hasNextLevel,
    get currentLevelId() { return currentLevelId; },
    get currentWaveId() { return currentWaveId; }
  };
})();
