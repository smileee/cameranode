import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const HLS_OUTPUT_DIR = 'recordings';
const HLS_SEGMENT_DURATION_SECONDS = 2; // This MUST match the streamer config

/**
 * Dynamically generates a VOD (Video on Demand) HLS playlist for a camera,
 * allowing for DVR-like playback of all buffered segments.
 */
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

        // Construct the HLS VOD playlist
        const playlistParts = [
            '#EXTM3U',
            '#EXT-X-VERSION:3',
            '#EXT-X-TARGETDURATION:' + HLS_SEGMENT_DURATION_SECONDS,
            '#EXT-X-PLAYLIST-TYPE:VOD', // VOD type allows seeking through the entire content
        ];

        for (const segment of segments) {
            playlistParts.push('#EXTINF:' + HLS_SEGMENT_DURATION_SECONDS.toFixed(4) + ',');
            // This URL structure will be understood by our unified media server
            playlistParts.push(`/api/media/dvr/${cameraId}/${segment}`);
        }

        playlistParts.push('#EXT-X-ENDLIST'); // Indicates the end of the playlist

        const playlist = playlistParts.join('\n');

        return new Response(playlist, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.apple.mpegurl',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
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