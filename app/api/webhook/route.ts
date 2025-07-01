import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { CAMERAS } from '@/cameras.config';
import { getCameraState, setCameraWebhookRecordingProcess, stopCameraWebhookRecordingProcess, clearCameraWebhookRecordingProcess } from '@/server/state';
import { addEvent } from '@/server/db';
import { generateThumbnail } from '@/server/ffmpeg-utils';

const CLIP_DURATION_SECONDS = 70;
const HARD_LIMIT_MS = 5 * 60 * 1000; // 5 minutes max per file

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
        outputPath
    ]);

    const timer = setTimeout(() => stopCameraWebhookRecordingProcess(cameraId), CLIP_DURATION_SECONDS * 1000);
    setCameraWebhookRecordingProcess(cameraId, ffmpegProcess, timer, Date.now());
    
    ffmpegProcess.on('exit', async (code, signal) => {
        console.log(`[Webhook FFMPEG exit ${cameraId}]: process exited with code ${code} and signal ${signal}.`);
        if (code === 0 || (signal === 'SIGTERM' || signal === 'SIGINT')) {
            console.log(`[Webhook Thumbnail ${cameraId}]: Generating thumbnail for ${outputFilename}`);
            await generateThumbnail(outputPath);
        }
        // Ensure we clear the recording state after the process exits.
        clearCameraWebhookRecordingProcess(cameraId);
    });

    ffmpegProcess.stderr.on('data', (data) => {
        console.log(`[Webhook FFMPEG stderr ${cameraId}]: ${data}`);
    });
}

async function sendSmsNotification(cameraName: string, eventInfo: { type: string, label?: string }) {
    const eventDescription = eventInfo.label ? `${eventInfo.type} (${eventInfo.label})` : eventInfo.type;
    const message = `Camera ${cameraName}: ${eventDescription} detected.`;
    const phoneNumbers = ["+17743010298", "+5084153606"];

    const payload = {
        messages: phoneNumbers.map(number => ({
            number,
            message
        }))
    };

    try {
        console.log(`[SMS] Sending notification for ${eventDescription} on camera ${cameraName}`);
        const response = await fetch('https://gateway-pool.sendeasy.pro/bulk-sms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': '08164ddd-61aa-4c7b-8faa-e24ba7e3bfe0',
                'Authorization': 'Bearer 08164ddd-61aa-4c7b-8faa-e24ba7e3bfe0'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log('[SMS] Notification sent successfully.');
        } else {
            const errorBody = await response.text();
            console.error(`[SMS] Failed to send notification: ${response.status} ${response.statusText}`, errorBody);
        }
    } catch (error) {
        console.error('[SMS] Error sending notification:', error);
    }
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

    // Send SMS notification (fire-and-forget)
    sendSmsNotification(camera.name, eventData).catch(err => console.error('[SMS] Failed to send notification:', err));

    const state = getCameraState(cameraId);
    if (state.isWebhookRecording && state.webhookRecordingProcess && state.webhookRecordingTimer) {
        const now = Date.now();
        const recordingElapsed = state.webhookRecordingStartedAt ? (now - state.webhookRecordingStartedAt) : 0;

        // Se já ultrapassou o limite duro, fecha e inicia novo
        if (recordingElapsed > HARD_LIMIT_MS) {
            console.log(`[Webhook] Recording for camera ${cameraId} exceeded hard limit (${HARD_LIMIT_MS} ms). Restarting.`);
            stopCameraWebhookRecordingProcess(cameraId);
            // Pequeno atraso para garantir que o processo fecha antes de iniciar outro
            setTimeout(() => startNewWebhookRecording(camera, eventData), 500);
        } else {
            console.log(`[Webhook] Extending recording for camera ${cameraId}`);
            const newTimer = setTimeout(() => stopCameraWebhookRecordingProcess(cameraId), CLIP_DURATION_SECONDS * 1000);
            setCameraWebhookRecordingProcess(cameraId, state.webhookRecordingProcess, newTimer);
        }
    } else {
        startNewWebhookRecording(camera, eventData);
    }

    return NextResponse.json({ success: true, message: 'Recording triggered or extended.' });
} 