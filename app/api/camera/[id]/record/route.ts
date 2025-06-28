import { NextRequest, NextResponse } from 'next/server';
import { CAMERAS } from '@/cameras.config';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { getCameraState, setCameraManualRecordingProcess, clearCameraManualRecordingProcess } from '@/server/state';
import { generateThumbnail } from '@/server/ffmpeg-utils';

const resolveFfmpegPath = () => {
    try {
        return (eval('require'))('ffmpeg-static') as string;
    } catch (e) {
        console.warn('[ManualRecording] ffmpeg-static not found, falling back to system ffmpeg');
        return 'ffmpeg';
    }
};

const FFMPEG_PATH = resolveFfmpegPath();

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const cameraId = params.id;
    const camera = CAMERAS.find(c => c.id === cameraId);

    if (!camera) {
        return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
    }

    const { action } = await req.json();

    const state = getCameraState(cameraId);

    if (action === 'start') {
        if (state.isManualRecording || state.isWebhookRecording) {
            return NextResponse.json({ error: 'Camera is already recording.' }, { status: 409 }); // 409 Conflict
        }

        const { rtspUrl } = camera;
        const recordingsDir = path.join(process.cwd(), 'recordings', cameraId);
        await fs.mkdir(recordingsDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const outputPath = path.join(recordingsDir, `manual-rec-${timestamp}.mp4`);

        const ffmpegArgs = [
            '-y',
            '-i', rtspUrl,
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-f', 'mp4',
            outputPath
        ];

        console.log('Starting manual recording:', FFMPEG_PATH, ffmpegArgs.join(' '));
        const ffmpegProcess = spawn(FFMPEG_PATH, ffmpegArgs);
        setCameraManualRecordingProcess(cameraId, ffmpegProcess);

        ffmpegProcess.on('close', (code) => {
            console.log(`Manual recording process for ${cameraId} exited with code ${code}`);
            const state = getCameraState(cameraId);
            state.isManualRecording = false;
            state.manualRecordingProcess = null;
            
            console.log(`Manual recording for ${cameraId} finished. Generating thumbnail.`);
            generateThumbnail(outputPath);
        });

        ffmpegProcess.stderr.on('data', (data) => {
            console.error(`ffmpeg stderr (manual recording ${cameraId}): ${data}`);
        });

        return NextResponse.json({ success: true, message: 'Recording started.' });

    } else if (action === 'stop') {
        if (!state.isManualRecording) {
            return NextResponse.json({ error: 'Camera is not currently recording.' }, { status: 400 });
        }

        clearCameraManualRecordingProcess(cameraId);

        return NextResponse.json({ success: true, message: 'Recording stopped.' });

    } else {
        return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    }
} 