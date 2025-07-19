import { NextResponse } from 'next/server';
import path from 'path';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';

const MEDIA_DIR = 'recordings';

/**
 * Serves media files (HLS playlists, video segments, MP4 recordings, and JPG thumbnails)
 * from the 'recordings' directory.
 */
export async function GET(request: Request, { params }: { params: { slug: string[] } }) {
    const slug = params.slug;

    if (!slug || slug.length === 0) {
        return new Response('Invalid media path', { status: 400 });
    }

    let relativePath: string;

    // Handle the special case for live HLS streams
    if (slug[0] === 'live' && slug.length > 2) {
        // URL: /api/media/live/[cameraId]/[...filename]
        // Maps to: recordings/[cameraId]/live/[...filename]
        const [_live, cameraId, ...rest] = slug;
        const liveFileName = rest.join('/');
        relativePath = path.join(cameraId, 'live', liveFileName);
    } else {
        // Standard path for recordings and thumbnails
        // URL: /api/media/[cameraId]/[filename]
        // Maps to: recordings/[cameraId]/[filename]
        relativePath = slug.join('/');
    }

    const filePath = path.join(process.cwd(), MEDIA_DIR, relativePath);

    // --- Security Check ---
    // Ensure the resolved file path is still within the designated MEDIA_DIR
    const safeBasePath = path.resolve(process.cwd(), MEDIA_DIR);
    if (!path.resolve(filePath).startsWith(safeBasePath)) {
        console.warn(`[API/Media] Forbidden access attempt to: ${filePath}`);
        return new Response('Forbidden', { status: 403 });
    }
    
    try {
        const stats = await stat(filePath);
        const stream = createReadStream(filePath);
        
        // Determine Content-Type based on file extension
        const extension = path.extname(filePath).toLowerCase();
        let contentType = 'application/octet-stream'; // Default binary type
        
        if (extension === '.m3u8') {
            contentType = 'application/vnd.apple.mpegurl';
        } else if (extension === '.ts') {
            contentType = 'video/mp2t';
        } else if (extension === '.mp4') {
            contentType = 'video/mp4';
        } else if (extension === '.jpg' || extension === '.jpeg') {
            contentType = 'image/jpeg';
        }

        return new NextResponse(stream as any, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Length': stats.size.toString(),
                // Allow caching for static assets like MP4s and JPEGs
                'Cache-Control': (extension === '.mp4' || extension === '.jpg' || extension === '.jpeg') 
                    ? 'public, max-age=3600' // Cache for 1 hour
                    : 'no-cache, no-store, must-revalidate', // Do not cache HLS playlists/segments
            },
        });
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return new Response('File not found', { status: 404 });
        }
        console.error(`[API/Media] Error serving file ${filePath}:`, error);
        return new Response('Internal Server Error', { status: 500 });
    }
} 