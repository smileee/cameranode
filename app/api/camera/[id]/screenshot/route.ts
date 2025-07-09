import { NextRequest, NextResponse } from 'next/server';
import { CAMERAS } from '@/cameras.config';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

// Use a known path for ffmpeg, or fallback to the system path
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

async function getLatestSegment(liveDir: string): Promise<string | null> {
    try {
        const files = await fs.readdir(liveDir);
        const tsFiles = files
            .filter(file => file.endsWith('.ts'))
            .sort((a, b) => b.localeCompare(a)); // Sort descending to get the latest

        return tsFiles.length > 0 ? path.join(liveDir, tsFiles[0]) : null;
    } catch (error) {
        console.warn(`[Screenshot] Could not read HLS live directory: ${liveDir}`, error);
        return null;
    }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const cameraId = params.id;
    const camera = CAMERAS.find(c => c.id === cameraId);

    if (!camera) {
        return new Response('Camera not found', { status: 404 });
    }

    const liveDir = path.join(process.cwd(), 'recordings', cameraId, 'live');
    const latestSegment = await getLatestSegment(liveDir);

    if (!latestSegment) {
        console.warn(`[Screenshot] No HLS segments found for camera ${cameraId}. The stream might be down.`);
        return new Response('Live stream segment not available', { status: 404 });
    }

    const ffmpegArgs = [
        '-i', latestSegment, // Input from the latest segment
        '-vframes', '1',      // Extract a single frame
        '-q:v', '3',          // Good quality for JPEG
        '-f', 'image2pipe',   // Output to a pipe
        '-c:v', 'mjpeg',      // Codec for JPEG output
        'pipe:1'              // Output to stdout
    ];

    const ffmpegProcess = spawn(FFMPEG_PATH, ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

    // Pipe ffmpeg's stderr to the console for debugging
    ffmpegProcess.stderr.on('data', (data) => {
        console.error(`[ffmpeg-screenshot] stderr: ${data}`);
    });

    // Convert the Node.js Readable stream to a Web ReadableStream
    const stream = new ReadableStream({
        start(controller) {
            ffmpegProcess.stdout.on('data', (chunk) => {
                controller.enqueue(chunk);
            });
            ffmpegProcess.stdout.on('end', () => {
                controller.close();
            });
            ffmpegProcess.stdout.on('error', (err) => {
                controller.error(err);
            });
        },
        cancel() {
            ffmpegProcess.kill();
        },
    });

    return new Response(stream, {
        status: 200,
        headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
    });
} 