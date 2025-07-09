import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import { notFound } from 'next/navigation';
import mime from 'mime-types';

const RECORDINGS_DIR = path.join(process.cwd(), 'recordings');

export async function GET(req: NextRequest, { params }: { params: { slug: string[] } }) {
    // Basic security: sanitize the file path to prevent directory traversal.
    // The slug should represent a path within the RECORDINGS_DIR.
    // e.g., ['camera_id', 'live', 'live.m3u8'] or ['camera_id', 'recording.mp4']
    const safeSubPath = path.normalize(path.join(...params.slug)).replace(/^(\.\.(\/|\\|$))+/, '');
    const filePath = path.join(RECORDINGS_DIR, safeSubPath);

    // Security check: ensure the final resolved path is still within the recordings directory.
    if (!filePath.startsWith(RECORDINGS_DIR)) {
        console.warn(`[Media API] Forbidden access attempt: ${filePath}`);
        return new Response('Forbidden', { status: 403 });
    }

    try {
        const stats = await fs.stat(filePath);
        const contentType = mime.lookup(filePath) || 'application/octet-stream';
        const totalSize = stats.size;

        const headers = new Headers();

        // For HLS, it's crucial that the browser doesn't cache the playlist or segments.
        // This ensures the player always fetches the latest version.
        if (contentType === 'application/vnd.apple.mpegurl' || contentType === 'video/mp2t') {
            headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            headers.set('Pragma', 'no-cache');
            headers.set('Expires', '0');
        }

        const range = req.headers.get('range');

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
            const chunksize = (end - start) + 1;
            
            const file = await fs.open(filePath, 'r');
            const buffer = Buffer.alloc(chunksize);
            await file.read(buffer, 0, chunksize, start);
            await file.close();

            headers.set('Content-Range', `bytes ${start}-${end}/${totalSize}`);
            headers.set('Accept-Ranges', 'bytes');
            headers.set('Content-Length', chunksize.toString());
            headers.set('Content-Type', contentType);

            return new Response(buffer, { status: 206, headers });

        } else {
            const fileBuffer = await fs.readFile(filePath);
            headers.set('Content-Length', totalSize.toString());
            headers.set('Content-Type', contentType);
            headers.set('Accept-Ranges', 'bytes');
        
            return new Response(fileBuffer, { status: 200, headers });
        }

    } catch (error: any) {
        if (error.code === 'ENOENT') {
            // Standard "File Not Found"
            return new Response('File Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
        } else {
            console.error(`[Media API] Error reading file: ${filePath}`, error);
            return new Response('Internal Server Error', { status: 500, headers: { 'Content-Type': 'text/plain' } });
        }
    }
} 