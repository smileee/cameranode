import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import { deleteEventsById } from '@/server/db';

const RECORDINGS_DIR = path.join(process.cwd(), 'recordings');
const RETENTION_HOURS = 24; // Keep recordings for 24 hours.

/**
 * API route to clean up old recordings and their associated events.
 * Deletes .mp4 and .jpg files older than RETENTION_HOURS.
 * Also removes the corresponding events from the database.
 */
export async function POST() {
  console.log('[API/Cleanup] Received request to clean up old recordings.');

  try {
    const cameraDirs = await fs.readdir(RECORDINGS_DIR, { withFileTypes: true });
    let deletedFiles = 0;
    const eventIdsToDelete: string[] = [];

    for (const cameraDir of cameraDirs) {
      if (!cameraDir.isDirectory()) continue;

      const cameraPath = path.join(RECORDINGS_DIR, cameraDir.name);
      const files = await fs.readdir(cameraPath);
      const now = Date.now();

      for (const file of files) {
        if (!file.endsWith('.mp4') && !file.endsWith('.jpg')) continue;

        const filePath = path.join(cameraPath, file);
        const stats = await fs.stat(filePath);
        const fileAgeHours = (now - stats.mtime.getTime()) / (1000 * 60 * 60);

        if (fileAgeHours > RETENTION_HOURS) {
          await fs.unlink(filePath);
          deletedFiles++;
          console.log(`[Cleanup] Deleted old file: ${filePath}`);

          if (file.startsWith('rec-') && file.endsWith('.mp4')) {
            const eventId = file.replace('rec-', '').replace('.mp4', '');
            eventIdsToDelete.push(eventId);
          }
        }
      }
    }

    let deletedEvents = 0;
    if (eventIdsToDelete.length > 0) {
      deletedEvents = await deleteEventsById(eventIdsToDelete);
    }

    return NextResponse.json({
      message: 'Cleanup process completed.',
      deletedFiles,
      deletedEvents,
    });

  } catch (error: any) {
    console.error('[API/Cleanup] Error during cleanup:', error);
    return NextResponse.json({ error: 'Failed to perform cleanup.' }, { status: 500 });
  }
}
