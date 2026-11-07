// =====================================
// API client + session logging
// =====================================
// The game page is served by the same Express server as the API, so "/api" works
// everywhere. The other candidates make it keep working when the page is opened
// from another dev server (for example VS Code Live Server) or via a custom
// window.ASTROSPELL_API_ROOT.

const API_CANDIDATES = (function () {
  const list = [];
  if (window.ASTROSPELL_API_ROOT) list.push(window.ASTROSPELL_API_ROOT);
  if (location.protocol === 'http:' || location.protocol === 'https:') list.push('/api');
  list.push('http://localhost:3001/api');
  return Array.from(new Set(list));
})();

let activeApiRoot = null;
let sessionEnded = false;

async function apiFetch(path, options = {}) {
  const roots = activeApiRoot ? [activeApiRoot] : API_CANDIDATES;
  let lastError = null;

  for (const root of roots) {
    try {
      const response = await fetch(`${root}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
      if (!response.ok) {
        const error = new Error(`API request failed: ${response.status} ${await response.text()}`);
        error.status = response.status;
        throw error;
      }
      activeApiRoot = root; // remember the address that works
      return await response.json();
    } catch (error) {
      lastError = error;
      // Network errors, 404 and 405 mean "this is not the game server" -> try the next address.
      // Anything else is a real answer from the server, so report it.
      const wrongServer = !error.status || error.status === 404 || error.status === 405;
      if (activeApiRoot || !wrongServer) throw error;
    }
  }
  throw lastError || new Error('API unreachable');
}

window.apiFetch = apiFetch;
window.AstroSpellSessionId = null;

window.createGameSession = async function () {
  try {
    const data = await apiFetch('/session', {
      method: 'POST',
      body: JSON.stringify({ start_time: new Date().toISOString() })
    });
    window.AstroSpellSessionId = data.session_id || data._id || null;
    return window.AstroSpellSessionId;
  } catch (error) {
    console.warn('createGameSession failed (the game still works, but nothing is logged):', error.message);
    return null;
  }
};

window.endGameSession = async function () {
  if (!window.AstroSpellSessionId || sessionEnded) return null;
  sessionEnded = true;
  try {
    return await apiFetch(`/session/${window.AstroSpellSessionId}/end`, {
      method: 'PATCH',
      body: JSON.stringify({ end_time: new Date().toISOString() })
    });
  } catch (error) {
    console.warn('endGameSession failed:', error.message);
    return null;
  }
};

// Runs when the tab is closed. sendBeacon is built for exactly this and survives page unload.
// It is sent as text/plain so the browser does not need a CORS preflight first.
window.endGameSessionOnUnload = function () {
  if (!window.AstroSpellSessionId || sessionEnded) return null;
  sessionEnded = true;

  const root = activeApiRoot || API_CANDIDATES[0];
  const url = `${root}/session/${window.AstroSpellSessionId}/end`;
  const body = JSON.stringify({ end_time: new Date().toISOString() });

  try {
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain;charset=UTF-8' }))) return null;
  } catch (e) { /* fall through to fetch */ }

  try {
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body, keepalive: true }).catch(() => {});
  } catch (e) { /* nothing more we can do */ }
  return null;
};

// One handler is enough ("pagehide" also fires on mobile where "beforeunload" does not).
window.addEventListener('pagehide', window.endGameSessionOnUnload);

async function postLog(path, payload) {
  if (!window.AstroSpellSessionId) return null;
  try {
    return await apiFetch(path, { method: 'POST', body: JSON.stringify({ session_id: window.AstroSpellSessionId, ...payload }) });
  } catch (error) {
    console.warn(`log ${path} failed:`, error.message);
    return null;
  }
}

window.logActivity = (activity, details = {}) =>
  postLog('/activity', { activity, details, activity_time: new Date().toISOString() });

window.logSpokenWord = (expectedWord, spokenWord, isCorrect, expectedLetter = '') =>
  postLog('/spoken-word', {
    expected_word: expectedWord || '',
    expected_letter: expectedLetter || '',
    spoken_word: spokenWord || '',
    is_correct: Boolean(isCorrect),
    spoken_time: new Date().toISOString()
  });

window.logProgress = (level, wave, status) =>
  postLog('/progress', { level, wave, status, completed_time: new Date().toISOString() });
