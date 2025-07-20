import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { nanoid } from 'nanoid';
import { Event } from '@/types/event';
import { CameraSettings } from '@/types/settings';

let db: Database | null = null;

async function initializeDb() {
  if (db) return db;

  const sqlite = sqlite3.verbose();
  db = await open({
    filename: './db.sqlite',
    driver: sqlite.Database
  });

  console.log('[DB] Connected to SQLite database.');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      cameraId TEXT NOT NULL,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      payload TEXT,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS camera_settings (
      cameraId TEXT PRIMARY KEY,
      settings TEXT NOT NULL
    );
  `);

  console.log('[DB] Tables initialized.');
  return db;
}

// Ensure the DB is initialized when the module is loaded
initializeDb().catch(err => {
    console.error('[DB] Failed to initialize database:', err);
    process.exit(1);
});

// Functions to interact with the database will go here...

export async function addEvent(eventData: Omit<Event, 'id' | 'timestamp'>): Promise<Event> {
  const db = await initializeDb();
  const newEvent: Event = {
    id: nanoid(),
    timestamp: new Date().toISOString(),
    ...eventData,
  };

  await db.run(
    'INSERT INTO events (id, timestamp, cameraId, type, label, payload, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    newEvent.id,
    newEvent.timestamp,
    newEvent.cameraId,
    newEvent.type,
    newEvent.label,
    JSON.stringify(newEvent.payload || {}),
    newEvent.status
  );
  console.log(`[DB] Event added successfully: ${newEvent.id}`);
  return newEvent;
}

export async function getEventsForCamera(cameraId: string): Promise<Event[]> {
  const db = await initializeDb();
  const rows = await db.all('SELECT * FROM events WHERE cameraId = ? ORDER BY timestamp DESC', cameraId);
  return rows.map(row => ({
    ...row,
    payload: JSON.parse(row.payload),
  }));
}

export async function getCameraSettings(): Promise<CameraSettings> {
    const db = await initializeDb();
    const rows = await db.all('SELECT * FROM camera_settings');
    const settings: CameraSettings = {};
    for (const row of rows) {
        settings[row.cameraId] = JSON.parse(row.settings);
    }
    return settings;
}

export async function saveCameraSettings(newSettings: CameraSettings): Promise<void> {
    const db = await initializeDb();
    const stmt = await db.prepare('INSERT OR REPLACE INTO camera_settings (cameraId, settings) VALUES (?, ?)');
    for (const cameraId in newSettings) {
        await stmt.run(cameraId, JSON.stringify(newSettings[cameraId]));
    }
    await stmt.finalize();
    console.log('[DB] Camera settings saved successfully.');
}

export async function getEventById(id: string): Promise<Event | null> {
  const db = await initializeDb();
  const row = await db.get('SELECT * FROM events WHERE id = ?', id);
  if (!row) return null;
  return {
    ...row,
    payload: JSON.parse(row.payload),
  };
}

export async function updateEvent(id: string, updates: Partial<Omit<Event, 'id'>>): Promise<Event | null> {
  const db = await initializeDb();
  
  const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  if (!setClauses) return getEventById(id); // Nothing to update

  const values = Object.values(updates).map(v => typeof v === 'object' ? JSON.stringify(v) : v);
  
  const query = `UPDATE events SET ${setClauses} WHERE id = ?`;
  values.push(id);
  
  const result = await db.run(query, ...values);

  if (result.changes === 0) {
    console.warn(`[DB] updateEvent: Event with id ${id} not found.`);
    return null;
  }

  console.log(`[DB] Event updated successfully: ${id}`);
  return getEventById(id);
}


// ... (you can add deleteEventsById if needed, following the same pattern)

export { initializeDb }; 