import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getMediaMetadata, getEventsForVideo } from '@/server/db';
import { formatInTimeZone } from 'date-fns-tz';

const parseDateFromFilename = (filename: string): Date | null => {
    const match = filename.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z)/);
    if (match && match[1]) {
        const [datePart, timePart] = match[1].split('T');
        const correctedTimePart = timePart.replace(/-/g, ':');
        return new Date(`${datePart}T${correctedTimePart}`);
    }
    return null;
}

async function getMediaFiles(cameraId: string, page: number, limit: number) {
    const recordingsDir = path.join(process.cwd(), 'recordings', cameraId);

    const readDir = async (dir: string) => {
        try {
            return await fs.readdir(dir);
        } catch (error: any) {
            if (error.code === 'ENOENT') return [];
            throw error;
        }
    };
    
    const allFiles = (await readDir(recordingsDir)).map(f => ({ name: f, type: 'recording' }));

    const allThumbnails = allFiles
        .filter(file => file.name.endsWith('.jpg'))
        .sort((a, b) => {
            const dateA = parseDateFromFilename(a.name);
            const dateB = parseDateFromFilename(b.name);
            if (dateA && dateB) {
                return dateB.getTime() - dateA.getTime();
            }
            return b.name.localeCompare(a.name); // Fallback
        });

    const totalItems = allThumbnails.length;
    const totalPages = Math.ceil(totalItems / limit);
    const offset = (page - 1) * limit;
    
    const paginatedThumbnails = allThumbnails.slice(offset, offset + limit);

    const mediaItems = await Promise.all(paginatedThumbnails.map(async (thumb) => {
        const fileBase = thumb.name.replace('.jpg', '');
        const hasVideo = allFiles.some(f => f.name === `${fileBase}.mp4`);
        
        const thumbnailPath = path.join('recordings', cameraId, thumb.name);
        const videoPath = hasVideo ? path.join('recordings', cameraId, `${fileBase}.mp4`) : null;
        
        const mediaId = videoPath || thumbnailPath;
        const metadata = await getMediaMetadata(mediaId);
        const events = await getEventsForVideo(mediaId);
        
        const date = parseDateFromFilename(thumb.name);
        const isValidDate = date && !isNaN(date.getTime());

        const formattedDate = isValidDate
            ? formatInTimeZone(date, 'America/New_York', 'MMM dd, yyyy, hh:mm:ss a zzz')
            : 'Date not found';

        return {
            id: mediaId,
            thumbnail: thumbnailPath,
            video: videoPath,
            isFavorite: metadata.isFavorite,
            events: events,
            formattedDate: formattedDate,
            fileName: thumb.name,
        };
    }));

    return { mediaItems, totalPages, currentPage: page };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '8', 10);
  
    try {
      const data = await getMediaFiles(params.id, page, limit);
      return NextResponse.json(data);
    } catch (error) {
      console.error('Failed to get media files:', error);
      return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
} 