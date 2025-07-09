import path from 'path';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { nanoid } from 'nanoid';

export interface Event {
    id: string;
    timestamp: string;
    cameraId: string;
    type: 'detection';
    label: string;
    status: 'pending' | 'processed';
    videoPath?: string; // Path to the generated MP4 file
}

export interface DbData {
    events: Event[];
}

// Use a singleton pattern to ensure we only have one instance of the database
// and that it's only initialized when first needed (lazy initialization).
let dbInstance: Low<DbData> | null = null;
let initializationPromise: Promise<void> | null = null;

const defaultData: DbData = {
    events: [],
};

export async function getDB(): Promise<Low<DbData>> {
    // If the instance already exists, return it.
    if (dbInstance) {
        return dbInstance;
    }

    // If initialization is in progress, wait for it to complete.
    if (initializationPromise) {
        await initializationPromise;
        return dbInstance!;
    }
    
    // Start the initialization process.
    initializationPromise = (async () => {
        const dbPath = path.join(process.cwd(), 'db.json');
        const adapter = new JSONFile<DbData>(dbPath);
        const db = new Low<DbData>(adapter, defaultData);
        
        await db.read().catch(err => {
            console.error("Error reading db.json, starting with default data.", err);
        });

        // Ensure data structure is sound
        db.data ||= defaultData;
        db.data.events ||= [];
        
        dbInstance = db;
    })();

    await initializationPromise;
    initializationPromise = null; // Reset for any subsequent re-initialization needs
    return dbInstance!;
}

export async function addEvent(eventData: { cameraId: string, type: 'detection', label: string }): Promise<Event> {
    const db = await getDB();
    await db.read();
    const newEvent: Event = {
        id: nanoid(),
        timestamp: new Date().toISOString(),
        cameraId: eventData.cameraId,
        type: eventData.type,
        label: eventData.label,
        status: 'pending', // Always start as pending
    };
    db.data.events.push(newEvent);
    await db.write();
    return newEvent;
}

/**
 * Updates an event in the database.
 * @param eventId The ID of the event to update.
 * @param updates The fields to update.
 * @returns The updated event or null if not found.
 */
export async function updateEvent(eventId: string, updates: Partial<Pick<Event, 'status' | 'videoPath'>>): Promise<Event | null> {
    const db = await getDB();
    await db.read(); 
    const event = db.data.events.find(e => e.id === eventId);
    if (event) {
        Object.assign(event, updates);
        await db.write();
        return event;
    }
    return null;
}

export async function getEventsForCamera(cameraId: string): Promise<Event[]> {
    const db = await getDB();
    if (!db.data) return [];
    return db.data.events
        .filter(event => event.cameraId === cameraId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
} 