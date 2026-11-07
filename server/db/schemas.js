import { ObjectId } from 'mongodb';

export function isValidId(id) {
  return typeof id === 'string' && ObjectId.isValid(id) && String(new ObjectId(id)) === id;
}

// Never trust a client-supplied timestamp: fall back to "now" when it is missing or invalid.
export function safeDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function buildGameSession(start_time) {
  return {
    start_time: safeDate(start_time),
    end_time: null
  };
}

export function buildActivityLog({ session_id, activity, details = {}, activity_time }) {
  return {
    session_id: new ObjectId(session_id),
    activity: String(activity).slice(0, 64),
    details: details && typeof details === 'object' ? details : {},
    activity_time: safeDate(activity_time)
  };
}

export function buildSpokenWord({ session_id, expected_word, expected_letter, spoken_word, is_correct, spoken_time }) {
  return {
    session_id: new ObjectId(session_id),
    expected_word: String(expected_word || '').slice(0, 64),
    expected_letter: String(expected_letter || '').slice(0, 1),
    spoken_word: String(spoken_word || '').slice(0, 64),
    is_correct: Boolean(is_correct),
    spoken_time: safeDate(spoken_time)
  };
}

export function buildProgress({ session_id, level, wave, status, completed_time }) {
  return {
    session_id: new ObjectId(session_id),
    level: Number(level),
    wave: Number(wave),
    status,
    completed_time: safeDate(completed_time)
  };
}

// Remembers exactly which levels a player was given, so a session can be replayed or analysed.
export function buildGeneratedLevels({ session_id, seed, levels }) {
  return {
    session_id: new ObjectId(session_id),
    seed,
    levels,
    created_at: new Date()
  };
}
