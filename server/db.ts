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

class LowDBAdapter {
  private db!: Low<Data>;
  private defaultData: Data = {
    favorites: {},
    events: [],
  };
  private initializationPromise: Promise<void>;

  constructor() {
    this.initializationPromise = this.initialize();
  }
  
  private async initialize(): Promise<void> {
    const dbPath = path.join(process.cwd(), 'db.json');
    const adapter = new JSONFile<Data>(dbPath);
    this.db = new Low<Data>(adapter, this.defaultData);
    
    await this.db.read();
    
    this.db.data ||= this.defaultData;
    this.db.data.favorites ||= {};
    this.db.data.events ||= [];
    
    await this.db.write();
  }

  async getMediaMetadata(filePath: string): Promise<{ isFavorite: boolean }> {
    await this.initializationPromise;
    return this.db.data.favorites[filePath] || { isFavorite: false };
  }

  async setFavorite(filePath: string, isFavorite: boolean): Promise<void> {
    await this.initializationPromise;
    this.db.data.favorites[filePath] = { isFavorite };
    await this.db.write();
  }

  async addEvent(event: { cameraId: string, type: string, label?: string }): Promise<void> {
    await this.initializationPromise;
    this.db.data.events.push({
        ...event,
        timestamp: new Date().toISOString(),
    });
    await this.db.write();
  }

  async getEventsForVideo(videoPath: string, windowSeconds: number = 70): Promise<Event[]> {
      await this.initializationPromise;
      
      const videoStartDate = parseDateFromFilename(videoPath);
      
      if (!videoStartDate || isNaN(videoStartDate.getTime())) {
          return [];
      }

      const videoEndDate = new Date(videoStartDate.getTime() + windowSeconds * 1000);

      return this.db.data.events.filter(event => {
          const eventDate = new Date(event.timestamp);
          return eventDate >= videoStartDate && eventDate <= videoEndDate;
      });
  }
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

const dbInstance = new LowDBAdapter();

export const getMediaMetadata = dbInstance.getMediaMetadata.bind(dbInstance);
export const setFavorite = dbInstance.setFavorite.bind(dbInstance);
export const addEvent = dbInstance.addEvent.bind(dbInstance);
export const getEventsForVideo = dbInstance.getEventsForVideo.bind(dbInstance); 