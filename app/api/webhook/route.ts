import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { CAMERAS } from '@/cameras.config';
import { getCameraState, setCameraWebhookRecordingProcess, stopCameraWebhookRecordingProcess } from '@/server/state';
import { addEvent } from '@/server/db';
import { generateThumbnail } from '@/server/ffmpeg-utils';

const CLIP_DURATION_SECONDS = 70;

async function startNewWebhookRecording(camera: (typeof CAMERAS)[0], eventInfo: { type: string, label?: string }) {
    const cameraId = camera.id;
    const eventName = eventInfo.label ? `${eventInfo.type}-${eventInfo.label}` : eventInfo.type;
    console.log(`[Webhook] Starting new recording for camera ${cameraId} triggered by event: ${eventName}`);
    
    const recordingsDir = path.join(process.cwd(), 'recordings', cameraId);
    await fs.mkdir(recordingsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const outputFilename = `webhook-rec-${eventName}-${timestamp}.mp4`;
    const outputPath = path.join(recordingsDir, outputFilename);
    const thumbnailPath = outputPath.replace('.mp4', '.jpg');

    const ffmpegProcess = spawn('ffmpeg', [
        '-rtsp_transport', 'tcp',
        '-i', camera.rtspUrl,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-t', String(CLIP_DURATION_SECONDS + 10), // Record a bit longer just in case
        outputPath
    ]);

    const timer = setTimeout(() => stopCameraWebhookRecordingProcess(cameraId), CLIP_DURATION_SECONDS * 1000);
    setCameraWebhookRecordingProcess(cameraId, ffmpegProcess, timer);
    
    ffmpegProcess.on('exit', async (code, signal) => {
        console.log(`[Webhook FFMPEG exit ${cameraId}]: process exited with code ${code} and signal ${signal}.`);
        if (code === 0 || (signal === 'SIGTERM' || signal === 'SIGINT')) {
            console.log(`[Webhook Thumbnail ${cameraId}]: Generating thumbnail for ${outputFilename}`);
            await generateThumbnail(outputPath);
        }
        // clearCameraWebhookRecordingProcess is called by stopCameraWebhookRecordingProcess
    });

    ffmpegProcess.stderr.on('data', (data) => {
        console.log(`[Webhook FFMPEG stderr ${cameraId}]: ${data}`);
    });
}

export async function POST(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const cameraId = searchParams.get('id');
    
    if (!cameraId) {
        return new Response('Camera ID is required', { status: 400 });
    }
    
    const camera = CAMERAS.find(c => c.id === cameraId);
    if (!camera) {
        return new Response('Camera not found', { status: 404 });
    }

    let eventData = { type: 'motion', label: 'unknown_payload' };
    try {
        const payload = await req.json();
        eventData = {
            type: payload.type || 'motion',
            label: payload.label
        };
    } catch (error) {
        console.warn('[WEBHOOK] Could not parse event JSON, using fallback data.');
    }
    
    // Save event to DB (fire-and-forget)
    addEvent({ cameraId, ...eventData }).catch(err => console.error('[WEBHOOK DB] Failed to save event:', err));

    const state = getCameraState(cameraId);
    if (state.isWebhookRecording && state.webhookRecordingProcess && state.webhookRecordingTimer) {
        console.log(`[Webhook] Extending recording for camera ${cameraId}`);
        const newTimer = setTimeout(() => stopCameraWebhookRecordingProcess(cameraId), CLIP_DURATION_SECONDS * 1000);
        setCameraWebhookRecordingProcess(cameraId, state.webhookRecordingProcess, newTimer);
    } else {
        startNewWebhookRecording(camera, eventData);
    }

    return NextResponse.json({ success: true, message: 'Recording triggered or extended.' });
} 