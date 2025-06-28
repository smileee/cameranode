import { NextRequest, NextResponse } from 'next/server';
import { CAMERAS } from '@/cameras.config';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import ffmpegPath from 'ffmpeg-static';

const FFMPEG_PATH = ffmpegPath || 'ffmpeg';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const cameraId = params.id;
    const camera = CAMERAS.find(c => c.id === cameraId);

    if (!camera) {
        return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
    }

    const { rtspUrl } = camera;
    
    const screenshotsDir = path.join(process.cwd(), 'screenshots', cameraId);
    await fs.mkdir(screenshotsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const outputPath = path.join(screenshotsDir, `screenshot-${timestamp}.jpg`);

    const ffmpegArgs = [
        '-y',
        '-i', rtspUrl,
        '-vframes', '1',
        '-q:v', '2', // Best quality
        outputPath
    ];

    console.log('Running ffmpeg for screenshot:', FFMPEG_PATH, ffmpegArgs.join(' '));

    const ffmpegProcess = spawn(FFMPEG_PATH, ffmpegArgs);

    return new Promise((resolve) => {
        ffmpegProcess.on('close', (code) => {
            if (code === 0) {
                console.log('Screenshot saved to', outputPath);
                resolve(NextResponse.json({ success: true, path: outputPath }));
            } else {
                console.error(`ffmpeg process exited with code ${code}`);
                resolve(NextResponse.json({ error: 'Failed to take screenshot' }, { status: 500 }));
            }
        });

        ffmpegProcess.stderr.on('data', (data) => {
            console.error(`ffmpeg stderr: ${data}`);
        });

         ffmpegProcess.on('error', (err) => {
            console.error('Failed to start ffmpeg process for screenshot:', err);
            resolve(NextResponse.json({ error: 'Failed to start ffmpeg process' }, { status: 500 }));
        });
    });
} 