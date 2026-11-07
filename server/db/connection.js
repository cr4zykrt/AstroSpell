import { MongoClient } from 'mongodb';

let client = null;
let database = null;
let connecting = null;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Connects once and reuses the connection. Reads the environment lazily so it
// works no matter when dotenv runs. Safe to call from every request: if the
// database was down earlier it simply tries again.
export async function connectToDatabase() {
  if (database) return database;
  if (connecting) return connecting;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set (copy .env.example to .env)');

  connecting = (async () => {
    const newClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await newClient.connect();
    client = newClient;
    database = newClient.db(process.env.DB_NAME || 'AstroSpell');
    return database;
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

// Used by the models: turns "database is down" into a clean 503 instead of a crash.
export async function getDb() {
  try {
    return await connectToDatabase();
  } catch (error) {
    console.error('Database unavailable:', error.message);
    throw new HttpError(503, 'Database unavailable');
  }
}

export async function closeDatabase() {
  if (client) await client.close();
  client = null;
  database = null;
}
