import { NextResponse } from 'next/server';
import path from 'path';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';

const MEDIA_DIR = 'recordings';

/**
 * Serves media files (HLS playlists, video segments, MP4 recordings, and JPG thumbnails)
 * from the 'recordings' directory. It uses a generic slug-based path.
 *
 * URL structure: /api/media/[...pathParts]
 * e.g.,
 * - HLS Playlist: /api/media/1/live/live.m3u8
 * - HLS Segment:  /api/media/1/live/segment123.ts
 * - MP4 Recording: /api/media/1/rec-abc123.mp4
 * - JPG Thumbnail: /api/media/1/thumb-abc123.jpg
 */
export async function GET(request: Request, { params }: { params: { slug: string[] } }) {
    const slug = params.slug;

    if (!slug || slug.length === 0) {
        return new Response('Invalid media path', { status: 400 });
    }

    // The slug array is the path parts. Join them to form the relative path.
    const relativePath = slug.join('/');
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