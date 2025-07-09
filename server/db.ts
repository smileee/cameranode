import path from 'path';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

type Event = {
  cameraId: string;
  timestamp: string;
  type: string;
  label?: string;
};

type Data = {
  favorites: { [filePath:string]: { isFavorite: boolean } };
  events: Event[];
};

// Use a singleton pattern to ensure we only have one instance of the database
// and that it's only initialized when first needed (lazy initialization).
let dbInstance: Low<Data> | null = null;
let initializationPromise: Promise<void> | null = null;

const defaultData: Data = {
    favorites: {},
    events: [],
};

async function getDB(): Promise<Low<Data>> {
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
        const adapter = new JSONFile<Data>(dbPath);
        const db = new Low<Data>(adapter, defaultData);
        
        await db.read().catch(err => {
            // This can happen if the file is empty or corrupted.
            // We'll proceed with default data.
            console.warn(`Could not read db.json, starting fresh. Error: ${err.message}`);
            db.data = defaultData;
        });

        // Ensure data structure is sound
        db.data ||= defaultData;
        db.data.favorites ||= {};
        db.data.events ||= [];
        
        await db.write();

        dbInstance = db;
    })();

    await initializationPromise;
    initializationPromise = null; // Reset for any subsequent re-initialization needs
    return dbInstance!;
}

export async function getMediaMetadata(filePath: string): Promise<{ isFavorite: boolean }> {
    const db = await getDB();
    return db.data?.favorites[filePath] || { isFavorite: false };
}

export async function setFavorite(filePath: string, isFavorite: boolean): Promise<void> {
    const db = await getDB();
    if (!db.data) return;
    db.data.favorites[filePath] = { isFavorite };
    await db.write();
}

export async function addEvent(event: { cameraId: string, type: string, label?: string }): Promise<void> {
    const db = await getDB();
    if (!db.data) return;
    db.data.events.push({
        ...event,
        timestamp: new Date().toISOString(),
    });
    await db.write();
}

export async function getEventsForVideo(videoPath: string, windowSeconds: number = 70): Promise<Event[]> {
    const db = await getDB();
    if (!db.data) return [];
      
    const videoStartDate = parseDateFromFilename(videoPath);
      
    if (!videoStartDate || isNaN(videoStartDate.getTime())) {
        return [];
    }

    const videoEndDate = new Date(videoStartDate.getTime() + windowSeconds * 1000);

    return db.data.events.filter(event => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= videoStartDate && eventDate <= videoEndDate;
    });
}

export async function getEventsForCamera(cameraId: string): Promise<Event[]> {
    const db = await getDB();
    if (!db.data) return [];
    return db.data.events
        .filter(event => event.cameraId === cameraId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function parseDateFromFilename(filename: string): Date | null {
    const match = filename.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z)/);
    if (match && match[1]) {
        const [datePart, timePart] = match[1].split('T');
        if (datePart && timePart) {
            const correctedTimePart = timePart.replace(/-/g, ':');
            return new Date(`${datePart}T${correctedTimePart}`);
        }
    }
    return null;
} 