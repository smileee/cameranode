import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    const { id: cameraId } = params;
    const playlistPath = path.join(process.cwd(), 'recordings', cameraId, 'live', 'live.m3u8');

    try {
        const m3u8Content = fs.readFileSync(playlistPath, 'utf-8');
        return new NextResponse(m3u8Content, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.apple.mpegurl',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        });
    } catch (error) {
        // If the file doesn't exist, it's a 404
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return new NextResponse('Playlist not found.', { status: 404 });
        }
        // For other errors, it's a 500
        console.error(`[Playlist] Failed to read playlist for camera ${cameraId}:`, error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
} 