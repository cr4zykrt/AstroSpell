// =====================================
// AstroSpell
// =====================================

window.addEventListener('load', () => {
  // Start the logging session. Level loading waits for this promise, so the server
  // can record which levels this player was given. It never rejects.
  window.sessionReady = (window.createGameSession ? window.createGameSession() : Promise.resolve(null))
    .then((sessionId) => {
      if (sessionId && window.logActivity) {
        window.logActivity('session_start', { source: 'page_load', session_id: sessionId });
      }
      return sessionId;
    })
    .catch(() => null);

  // Music and speech start on the first key press / tap (browsers block them before that).
  // The loading screen asks for that interaction.
  loadLoadingScreen();
});
