import { JSONFilePreset } from 'lowdb/node';
import { Low } from 'lowdb';
import path from 'path';
import { Event } from '@/types/event';
import { lock, unlock } from 'proper-lockfile';
import { nanoid } from 'nanoid';

const dbPath = path.join(process.cwd(), 'db.json');

type DbData = {
    events: Event[];
};

const defaultData: DbData = {
    events: [],
};

// --- Singleton DB Initializer (Race-condition and multi-process proof) ---
let dbPromise: Promise<Low<DbData>> | null = null;

const initializeDb = (): Promise<Low<DbData>> => {
  if (dbPromise) {
    return dbPromise;
  }
  
  // Start the initialization process and store the promise
  dbPromise = (async () => {
    // We create the LowDB instance with default data.
    const db = await JSONFilePreset<DbData>(dbPath, defaultData);
    
    // Acquire a lock before doing anything with the file system.
    const release = await lock(dbPath, { 
        retries: { retries: 5, factor: 1.2, minTimeout: 100 },
        stale: 5000 
    });

    try {
      await db.read();
    } catch (e: any) {
      console.error('[DB] Could not read db.json. This is expected if the file is new or was corrupted.', e.message);
    } finally {
      await release();
    }
    
    db.data ||= defaultData;
    
    await db.write();

    return db;
  })();
  
  return dbPromise;
};

// All DB functions will now get the DB instance via this function.
async function getDb(): Promise<Low<DbData>> {
  return initializeDb();
}


export async function getEvents(filters?: Partial<Event>): Promise<Event[]> {
    const db = await getDb();
    
    const release = await lock(dbPath, { stale: 5000, realpath: false, retries: { retries: 5, factor: 1.2, minTimeout: 100 } });
    try {
        await db.read();
        db.data ||= defaultData;
    } finally {
        await release();
    }

    if (!filters) {
        return db.data.events;
    }

    return db.data.events.filter(event => {
        return Object.entries(filters).every(([key, value]) => (event as any)[key] === value);
    });
}

export async function addEvent(eventData: Omit<Event, 'id' | 'timestamp'>): Promise<Event> {
    const db = await getDb();
    const newEvent: Event = {
        id: nanoid(),
        timestamp: new Date().toISOString(),
        ...eventData,
    };

    const release = await lock(dbPath, { stale: 5000, realpath: false, retries: { retries: 5, factor: 1.2, minTimeout: 100 } });
    try {
        await db.read();
        db.data ||= defaultData;
        db.data.events.unshift(newEvent);
        await db.write();
        console.log(`[DB] Event added successfully: ${newEvent.id}`);
        return newEvent;
    } catch (error) {
        console.error('[DB] Error adding event:', error);
        throw error;
    } finally {
        await release();
    }
}

export async function getEventById(id: string): Promise<Event | undefined> {
    const db = await getDb();
    const release = await lock(dbPath, { stale: 5000, realpath: false, retries: { retries: 5, factor: 1.2, minTimeout: 100 } });
    try {
        await db.read();
        db.data ||= defaultData;
    } finally {
        await release();
    }
    return db.data.events.find(event => event.id === id);
}

export async function getEventsForCamera(cameraId: string): Promise<Event[]> {
    const db = await getDb();
    
    const release = await lock(dbPath, { stale: 5000, realpath: false, retries: { retries: 5, factor: 1.2, minTimeout: 100 } });
    try {
        await db.read();
        db.data ||= defaultData;
    } finally {
        await release();
    }

    return db.data.events
        .filter(event => event.cameraId === cameraId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
} 