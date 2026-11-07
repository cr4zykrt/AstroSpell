import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { randomInt } from 'node:crypto';
import { fileURLToPath } from 'url';
import { connectToDatabase, HttpError } from './db/connection.js';
import { isValidId } from './db/schemas.js';
import {
  createGameSession,
  endGameSession,
  insertActivityLog,
  insertSpokenWord,
  insertProgress,
  saveGeneratedLevels
} from './db/models.js';
import { generateLevels, MAX_LEVELS } from './levels/generator.js';

const app = express();
const port = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(__dirname, '..');

// ---------- middleware ----------
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : undefined));
app.use(express.json({ limit: '50kb' }));
// "text/plain" lets the browser send the end-of-session beacon without a CORS preflight.
app.use(express.text({ type: 'text/plain', limit: '10kb' }));

// ---------- the game itself (only the public folders, never the server code) ----------
app.use('/css', express.static(path.join(rootDirectory, 'css')));
app.use('/js', express.static(path.join(rootDirectory, 'js')));
app.use('/assets', express.static(path.join(rootDirectory, 'assets'), { maxAge: '7d' }));
app.get('/', (req, res) => res.sendFile(path.join(rootDirectory, 'index.html')));

// ---------- helpers ----------
const asyncRoute = (handler) => (req, res) =>
  Promise.resolve(handler(req, res)).catch((error) => {
    const status = error.status || 500;
    if (status >= 500) console.error(`${req.method} ${req.path} failed:`, error.message);
    res.status(status).json({ error: status >= 500 && status !== 503 ? 'Internal server error' : error.message });
  });

// Body may arrive as JSON, or as a JSON string sent with text/plain (sendBeacon).
function readBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body && typeof req.body === 'object' ? req.body : {};
}

function requireSessionId(id) {
  if (!isValidId(id)) throw new HttpError(400, 'A valid session_id is required');
  return id;
}

const PROGRESS_STATUSES = ['started', 'completed', 'failed'];

// ---------- API ----------
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// A brand-new set of levels on every call. Optional query parameters:
//   count=1..10      how many levels (default 10)
//   seed=<integer>   reproduce an earlier set of levels
//   session_id=<id>  remember which levels this session was given
app.get(
  '/api/levels',
  asyncRoute(async (req, res) => {
    const count = Number.parseInt(req.query.count, 10);
    const seed = req.query.seed !== undefined && req.query.seed !== '' ? Number(req.query.seed) : randomInt(1, 2 ** 31 - 1);
    if (!Number.isFinite(seed)) throw new HttpError(400, 'seed must be a number');

    const payload = generateLevels({ count: Number.isFinite(count) ? Math.min(count, MAX_LEVELS) : undefined, seed });

    if (isValidId(req.query.session_id)) {
      // Best effort only: a database problem must never stop the game from loading.
      saveGeneratedLevels({ session_id: req.query.session_id, seed: payload.seed, levels: payload.levels }).catch(() => {});
    }

    res.set('Cache-Control', 'no-store');
    res.json(payload);
  })
);

app.post(
  '/api/session',
  asyncRoute(async (req, res) => {
    const session = await createGameSession(readBody(req).start_time);
    res.status(201).json(session);
  })
);

const endSessionRoute = asyncRoute(async (req, res) => {
  const sessionId = requireSessionId(req.params.id);
  const result = await endGameSession(sessionId, readBody(req).end_time || new Date().toISOString());
  res.status(200).json(result);
});
app.patch('/api/session/:id/end', endSessionRoute);
app.post('/api/session/:id/end', endSessionRoute);

app.post(
  '/api/activity',
  asyncRoute(async (req, res) => {
    const { session_id, activity, details, activity_time } = readBody(req);
    requireSessionId(session_id);
    if (typeof activity !== 'string' || !activity) throw new HttpError(400, 'activity is required');
    res.status(201).json(await insertActivityLog({ session_id, activity, details, activity_time }));
  })
);

app.post(
  '/api/spoken-word',
  asyncRoute(async (req, res) => {
    const body = readBody(req);
    requireSessionId(body.session_id);
    res.status(201).json(await insertSpokenWord(body));
  })
);

app.post(
  '/api/progress',
  asyncRoute(async (req, res) => {
    const body = readBody(req);
    requireSessionId(body.session_id);
    if (!Number.isInteger(body.level) || !Number.isInteger(body.wave)) throw new HttpError(400, 'level and wave must be integers');
    if (!PROGRESS_STATUSES.includes(body.status)) throw new HttpError(400, `status must be one of: ${PROGRESS_STATUSES.join(', ')}`);
    res.status(201).json(await insertProgress(body));
  })
);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// ---------- start ----------
app.listen(port, () => {
  console.log(`AstroSpell is running at http://localhost:${port}`);
  // The game works without the database (levels are generated in memory); only logging needs it.
  connectToDatabase()
    .then(() => console.log('MongoDB connected'))
    .catch((error) => console.warn(`MongoDB not connected (${error.message}). The game still works, but sessions will not be logged.`));
});
