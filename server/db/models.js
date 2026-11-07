import { ObjectId } from 'mongodb';
import { getDb } from './connection.js';
import {
  buildGameSession,
  buildActivityLog,
  buildSpokenWord,
  buildProgress,
  buildGeneratedLevels
} from './schemas.js';

const SESSION_COLLECTION = 'game_sessions';
const ACTIVITY_COLLECTION = 'activity_logs';
const SPOKEN_WORD_COLLECTION = 'spoken_words';
const PROGRESS_COLLECTION = 'progress';
const GENERATED_LEVELS_COLLECTION = 'generated_levels';

export async function createGameSession(start_time) {
  const db = await getDb();
  const doc = buildGameSession(start_time);
  const result = await db.collection(SESSION_COLLECTION).insertOne(doc);
  return { session_id: result.insertedId.toString(), ...doc };
}

// Only the first "end" counts, so the beacon + a late request cannot overwrite the real end time.
export async function endGameSession(session_id, end_time) {
  const db = await getDb();
  const filter = { _id: new ObjectId(session_id), end_time: null };
  const update = { $set: { end_time: new Date(end_time) } };
  return db.collection(SESSION_COLLECTION).updateOne(filter, update);
}

export async function insertActivityLog(input) {
  const db = await getDb();
  const doc = buildActivityLog(input);
  const result = await db.collection(ACTIVITY_COLLECTION).insertOne(doc);
  return { log_id: result.insertedId.toString(), ...doc };
}

export async function insertSpokenWord(input) {
  const db = await getDb();
  const doc = buildSpokenWord(input);
  const result = await db.collection(SPOKEN_WORD_COLLECTION).insertOne(doc);
  return { log_id: result.insertedId.toString(), ...doc };
}

export async function insertProgress(input) {
  const db = await getDb();
  const doc = buildProgress(input);
  const result = await db.collection(PROGRESS_COLLECTION).insertOne(doc);
  return { log_id: result.insertedId.toString(), ...doc };
}

export async function saveGeneratedLevels(input) {
  const db = await getDb();
  const doc = buildGeneratedLevels(input);
  await db.collection(GENERATED_LEVELS_COLLECTION).insertOne(doc);
}
