import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const HLS_OUTPUT_DIR = 'recordings';
const HLS_SEGMENT_DURATION_SECONDS = 6; // This MUST match the streamer config

export async function GET(request: Request, { params }: { params: { id: string } }) {
    const cameraId = params.id;
    const liveDir = path.join(process.cwd(), HLS_OUTPUT_DIR, cameraId, 'live');

    try {
        const files = await fs.readdir(liveDir);
        const segments = files
            .filter(file => file.endsWith('.ts'))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        if (segments.length === 0) {
            return new Response('No segments available for this camera.', { status: 404 });
        }

        // Get the creation time of the first segment
        const firstSegmentPath = path.join(liveDir, segments[0]);
        const stats = await fs.stat(firstSegmentPath);
        const playlistStartTime = stats.mtime.getTime();

        const playlistParts = [
            '#EXTM3U',
            '#EXT-X-VERSION:3',
            '#EXT-X-TARGETDURATION:' + HLS_SEGMENT_DURATION_SECONDS,
            '#EXT-X-PLAYLIST-TYPE:VOD',
        ];

        for (const segment of segments) {
            playlistParts.push(`#EXTINF:${HLS_SEGMENT_DURATION_SECONDS.toFixed(4)},`);
            playlistParts.push(`/api/media/${cameraId}/live/${segment}`);
        }

        playlistParts.push('#EXT-X-ENDLIST');

        const playlist = playlistParts.join('\n');

        return new Response(playlist, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.apple.mpegurl',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'X-Playlist-Start-Time': String(playlistStartTime),
            },
        });
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return new Response(`No recordings directory found for camera ${cameraId}.`, { status: 404 });
        }
        console.error(`[API DVR Playlist] Error generating playlist for camera ${cameraId}:`, error);
        return new Response('Internal Server Error', { status: 500 });
    }
} 