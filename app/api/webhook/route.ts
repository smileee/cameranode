import { NextRequest, NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { CAMERAS } from '@/cameras.config';
import { getCameraState, setCameraWebhookRecordingProcess, clearCameraWebhookRecordingProcess, stopCameraWebhookRecordingProcess } from '@/server/state';
import { generateThumbnail } from '@/server/ffmpeg-utils';

const CLIP_DURATION_SECONDS = 60;
let ffmpegPath: string | null = null;

const resolveFfmpegPath = () => {
    if (ffmpegPath) return ffmpegPath;
    try {
        // Use eval to avoid Next.js bundler transforming the require call
        ffmpegPath = (eval('require'))('ffmpeg-static') as string;
    } catch (e) {
        console.warn('[Webhook] ffmpeg-static not found, falling back to system ffmpeg');
        ffmpegPath = 'ffmpeg';
    }
    return ffmpegPath;
};

const stopWebhookRecording = (cameraId: string) => {
    console.log(`[Webhook] Timer finished for camera ${cameraId}. Stopping recording.`);
    stopCameraWebhookRecordingProcess(cameraId);
};

async function startOrExtendWebhookRecording(camera: { id: string, rtspUrl: string }): Promise<void> {
    const { id: cameraId, rtspUrl } = camera;
    const state = getCameraState(cameraId);

    if (state.isManualRecording) {
        console.warn(`[Webhook] Received request to record camera ${cameraId}, but it is in manual recording mode. Skipping.`);
        return;
    }

    // If already recording, just extend the timer
    if (state.isWebhookRecording && state.webhookRecordingProcess) {
        console.log(`[Webhook] Received event for camera ${cameraId} while already recording. Extending duration.`);
        const newTimer = setTimeout(() => stopWebhookRecording(cameraId), CLIP_DURATION_SECONDS * 1000);
        setCameraWebhookRecordingProcess(cameraId, state.webhookRecordingProcess, newTimer);
        return;
    }

    console.log(`[Webhook] Starting new recording for camera ${cameraId}.`);

    const recordingsDir = path.join(process.cwd(), 'recordings', cameraId);
    await fs.mkdir(recordingsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const outputPath = path.join(recordingsDir, `webhook-rec-${timestamp}.mp4`);

    const ffmpegArgs = [
        '-y',
        '-i', rtspUrl,
        // '-t' is removed, we control the duration now
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-f', 'mp4',
        outputPath,
    ];

    const FFMPEG_PATH = resolveFfmpegPath();
    console.log(`[Webhook] Spawning FFmpeg for camera ${cameraId}: ${FFMPEG_PATH} ${ffmpegArgs.join(' ')}`);

    const ffmpegProcess = spawn(FFMPEG_PATH, ffmpegArgs);

    const recordingTimer = setTimeout(() => stopWebhookRecording(cameraId), CLIP_DURATION_SECONDS * 1000);
    setCameraWebhookRecordingProcess(cameraId, ffmpegProcess, recordingTimer);

    ffmpegProcess.stderr.on('data', (data) => {
        console.error(`[Webhook FFMPEG stderr ${cameraId}]: ${data}`);
    });

    ffmpegProcess.on('close', (code) => {
        console.log(`[Webhook] FFmpeg process for camera ${cameraId} exited with code ${code}.`);
        clearCameraWebhookRecordingProcess(cameraId); // Important to clear state and timers
        if (code !== 0 && code !== null) { // SIGINT results in code null
            console.error(`[Webhook] Recording failed for camera ${cameraId}. Exit code: ${code}`);
        } else {
            console.log(`[Webhook] Clip for ${cameraId} saved to ${outputPath}`);
            generateThumbnail(outputPath);
        }
    });
     ffmpegProcess.on('error', (err) => {
        console.error(`[Webhook] Failed to start FFmpeg process for camera ${cameraId}:`, err);
        clearCameraWebhookRecordingProcess(cameraId);
    });
}


export async function POST(req: NextRequest) {
    console.log(`[Webhook] --- Incoming request received at ${new Date().toISOString()} ---`);
    try {
        console.log('[Webhook] Reading request body as text...');
        const bodyText = await req.text();
        console.log('[Webhook] Raw body received:', `"${bodyText}"`); // Log with quotes to see whitespace

        if (!bodyText) {
            console.error('[Webhook] Rejecting request: Body is empty.');
            return NextResponse.json({ error: 'Request body is empty' }, { status: 400 });
        }

        console.log('[Webhook] Attempting to parse text as JSON...');
        const payload = JSON.parse(bodyText);
        console.log('[Webhook] Successfully parsed payload:', payload);

        const { camera_id, event } = payload;
        if (!camera_id) {
            console.error('[Webhook] Rejecting request: camera_id is missing.');
            return NextResponse.json({ error: 'camera_id is required' }, { status: 400 });
        }
        
        console.log(`[Webhook] Received event '${event || 'unknown'}' for camera_id: ${camera_id}`);

        const camera = CAMERAS.find(c => c.id === camera_id);
        if (!camera) {
            console.error(`[Webhook] Rejecting request: Camera with id ${camera_id} not found.`);
            return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
        }
        
        // Don't wait for the recording to finish
        startOrExtendWebhookRecording(camera);

        return NextResponse.json({ success: true, message: 'Recording triggered or extended.' });

    } catch (error) {
        console.error('[Webhook] Error processing request. The request body may be malformed.');
        console.error('[Webhook] Raw Error:', error);
        // Handle cases where body is not valid JSON
        if (error instanceof SyntaxError) {
             return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Invalid request' }, { status: 500 });
    }
} 