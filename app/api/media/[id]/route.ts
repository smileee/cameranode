import { NextResponse } from 'next/server';
import { getEventsForCamera } from '@/server/db';
import path from 'path';
import fs from 'fs/promises';

const HLS_OUTPUT_DIR = 'recordings';

/**
 * API route to get all processed media (recordings) for a specific camera.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
    const cameraId = params.id;
    if (!cameraId) {
        return NextResponse.json({ error: 'Camera ID is required' }, { status: 400 });
    }

    try {
        // Fetch all events for the camera from the database
        const allEvents = await getEventsForCamera(cameraId);

        // Filter for events that have been successfully processed and have a video path
        const processedRecordings = allEvents
            .filter(event => event.status === 'processed' && event.videoPath && !event.videoPath.startsWith('error-'))
            .map(event => {
                const videoPath = event.videoPath!;
                // Make the path relative to the project root so the client can fetch it.
                const relativePath = path.relative(process.cwd(), videoPath);
                
                return {
                    id: event.id,
                    timestamp: event.timestamp,
                    label: event.label,
                    url: `/api/media/file/${encodeURIComponent(relativePath)}`,
                    // We can add more metadata here if needed in the future
                };
            });

        return NextResponse.json(processedRecordings);
    } catch (error) {
        console.error(`[API Media] Error fetching recordings for camera ${cameraId}:`, error);
        return NextResponse.json({ error: 'Failed to fetch recordings' }, { status: 500 });
    }
} 