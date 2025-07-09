import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { stat } from 'fs/promises';

const HLS_OUTPUT_DIR = 'recordings';

/**
 * Serves HLS media files (playlists and segments) for both live and DVR streaming.
 * URL structure:
 * - Live playlist: /api/media/[cameraId]/live/live.m3u8
 * - Live segment:  /api/media/[cameraId]/live/[segment].ts
 * - DVR segment:   /api/media/dvr/[cameraId]/[segment].ts
 */
export async function GET(request: Request, { params }: { params: { slug: string[] } }) {
    const slug = params.slug;

    if (!slug || slug.length < 2) {
        return new Response('Invalid media path', { status: 400 });
    }

    let filePath: string;
    const streamType = slug[0]; // 'live' or 'dvr'

    if (streamType === 'live') {
        // Path for live files: [cameraId, 'live', 'live.m3u8' or 'segment.ts']
        const [_, cameraId, ...rest] = slug;
        const fileName = rest.join('/');
        filePath = path.join(process.cwd(), HLS_OUTPUT_DIR, cameraId, 'live', fileName);
    } else if (streamType === 'dvr') {
        // Path for DVR files: ['dvr', cameraId, 'segment.ts']
        const [_, cameraId, fileName] = slug;
        filePath = path.join(process.cwd(), HLS_OUTPUT_DIR, cameraId, 'live', fileName);
    } else {
        return new Response('Invalid stream type in path', { status: 400 });
    }
    
    // Sanitize path to prevent directory traversal
    const safeBasePath = path.join(process.cwd(), HLS_OUTPUT_DIR);
    if (!path.resolve(filePath).startsWith(safeBasePath)) {
        return new Response('Forbidden', { status: 403 });
    }
    
    try {
        const stats = await stat(filePath);
        const stream = fs.createReadStream(filePath);
        
        const contentType = filePath.endsWith('.m3u8') 
            ? 'application/vnd.apple.mpegurl' 
            : 'video/mp2t';

        return new NextResponse(stream as any, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Length': stats.size.toString(),
                'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
        });
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return new Response('File not found', { status: 404 });
        }
        console.error(`[API Media File] Error serving file ${filePath}:`, error);
        return new Response('Internal Server Error', { status: 500 });
    }
} 