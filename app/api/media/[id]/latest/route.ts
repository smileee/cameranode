import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const parseDateFromFilename = (filename: string): Date | null => {
    const match = filename.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z)/);
    if (match && match[1]) {
        const [datePart, timePart] = match[1].split('T');
        const correctedTimePart = timePart.replace(/-/g, ':');
        return new Date(`${datePart}T${correctedTimePart}`);
    }
    return null;
}

async function getLatestThumbnail(cameraId: string): Promise<string | null> {
    const recordingsDir = path.join(process.cwd(), 'recordings', cameraId);

    try {
        const allFiles = await fs.readdir(recordingsDir);
        
        const latestThumbnail = allFiles
            .filter(file => file.endsWith('.jpg'))
            .sort((a, b) => {
                const dateA = parseDateFromFilename(a);
                const dateB = parseDateFromFilename(b);
                if (dateA && dateB) {
                    return dateB.getTime() - dateA.getTime();
                }
                return b.localeCompare(a); // Fallback sort
            })
            .shift(); // Get the first one, which is the latest

        return latestThumbnail ? path.join('recordings', cameraId, latestThumbnail) : null;

    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return null; // No directory means no thumbnails
        }
        throw error;
    }
}

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const latestThumbnailPath = await getLatestThumbnail(params.id);

        if (!latestThumbnailPath) {
            return NextResponse.json({ error: 'No thumbnails found for this camera' }, { status: 404 });
        }
        
        return NextResponse.json({ thumbnailUrl: `/api/media/${latestThumbnailPath}` });

    } catch (error) {
        console.error('Failed to get latest thumbnail:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
} 