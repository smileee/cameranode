import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const HLS_OUTPUT_DIR = 'recordings';
const HLS_SEGMENT_DURATION_SECONDS = 6;
const MAX_PLAYLIST_SEGMENTS = 5; // Keep the playlist from growing indefinitely

let mediaSequence = 0;

export async function GET(request: Request, { params }: { params: { id: string } }) {
    const cameraId = params.id;
    const liveDir = path.join(process.cwd(), HLS_OUTPUT_DIR, cameraId, 'live');

    try {
        const files = await fs.readdir(liveDir);
        let segments = files
            .filter(file => file.endsWith('.ts'))
            .sort((a, b) => {
                const numA = parseInt(a.replace('live', '').replace('.ts', ''));
                const numB = parseInt(b.replace('live', '').replace('.ts', ''));
                return numA - numB;
            });

        if (segments.length === 0) {
            return new Response('No segments available for this camera.', { status: 404 });
        }
        
        // If the number of segments exceeds the max, we slide the window
        if (segments.length > MAX_PLAYLIST_SEGMENTS) {
            const firstSegmentIndex = segments.length - MAX_PLAYLIST_SEGMENTS;
            const firstSegmentName = segments[firstSegmentIndex];
            mediaSequence = parseInt(firstSegmentName.replace('live', '').replace('.ts', ''));
            segments = segments.slice(firstSegmentIndex);
        } else {
            mediaSequence = 0;
        }

        const playlistParts = [
            '#EXTM3U',
            '#EXT-X-VERSION:3',
            '#EXT-X-TARGETDURATION:' + (HLS_SEGMENT_DURATION_SECONDS + 2), // A bit of buffer
            `#EXT-X-MEDIA-SEQUENCE:${mediaSequence}`,
            '#EXT-X-PLAYLIST-TYPE:EVENT', // Changed from VOD to EVENT for live
        ];

        for (const segment of segments) {
            playlistParts.push(`#EXTINF:${HLS_SEGMENT_DURATION_SECONDS.toFixed(4)},`);
            playlistParts.push(`/api/media/${cameraId}/live/${segment}`);
        }

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
        console.error(`[API Live Playlist] Error generating playlist for camera ${cameraId}:`, error);
        return new Response('Internal Server Error', { status: 500 });
    }
} 