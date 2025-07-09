import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Camera, CAMERAS } from '@/cameras.config';
import { getCameraState, setWebhookRecording, clearWebhookRecording } from '@/server/state';
import { addEvent } from '@/server/db';
import { generateThumbnail, concatenateSegments } from '@/server/ffmpeg-utils';

const CLIP_DURATION_SECONDS = 75; // 1 min 15 seconds
const PRE_ROLL_SECONDS = 15;
const HLS_SEGMENT_DURATION_SECONDS = 2; // Must match the setting in streamer.ts

type EventInfo = { type: string, label?: string };

// This will be stored in the CameraState
type WebhookRecordingData = {
    stopTimer: NodeJS.Timeout;
    monitorInterval: NodeJS.Timer;
    segmentsToRecord: Set<string>;
    eventInfo: EventInfo;
    finalFilename: string;
};

async function finalizeRecording(cameraId: string) {
    const state = getCameraState(cameraId);
    const recordingData = state.webhookRecording as WebhookRecordingData | null;

    if (!recordingData) {
        console.warn(`[Webhook ${cameraId}] Finalize called but no recording data found.`);
        return;
    }

    console.log(`[Webhook ${cameraId}] Finalizing recording for event: ${recordingData.eventInfo.label}`);

    // Stop collecting new segments
    clearInterval(recordingData.monitorInterval);
    clearWebhookRecording(cameraId);

    const liveDir = path.join(process.cwd(), 'recordings', cameraId, 'live');
    const permanentDir = path.join(process.cwd(), 'recordings', cameraId);
    const finalOutputPath = path.join(permanentDir, recordingData.finalFilename);

    // Convert the Set to an ordered array of segment filenames.
    // The HLS segments are named sequentially (segment000001.ts, segment000002.ts, ...),
    // so a simple sort will put them in the correct chronological order.
    const sortedSegments = Array.from(recordingData.segmentsToRecord).sort();

    if (sortedSegments.length === 0) {
        console.error(`[Webhook ${cameraId}] No segments were collected for the recording. Aborting.`);
        return;
    }

    console.log(`[Webhook ${cameraId}] Concatenating ${sortedSegments.length} segments into ${finalOutputPath}`);

    const success = await concatenateSegments(sortedSegments, liveDir, finalOutputPath);

    if (success) {
        console.log(`[Webhook ${cameraId}] Successfully created recording. Generating thumbnail.`);
        await generateThumbnail(finalOutputPath);
    } else {
        console.error(`[Webhook ${cameraId}] Failed to create recording.`);
    }
}


async function startNewWebhookRecording(camera: Camera, eventInfo: EventInfo) {
    const cameraId = camera.id;
    console.log(`[Webhook ${cameraId}] Starting new recording for event: ${eventInfo.label}`);
    const state = getCameraState(cameraId);

    // --- Pre-roll ---
    // Calculate how many segments are needed for the pre-roll duration.
    const preRollSegmentCount = Math.floor(PRE_ROLL_SECONDS / HLS_SEGMENT_DURATION_SECONDS);
    // Get the most recent segments from the buffer for the pre-roll.
    const preRollSegments = state.hlsSegmentBuffer.slice(-preRollSegmentCount).map(s => s.filename);

    const segmentsToRecord = new Set<string>(preRollSegments);
    console.log(`[Webhook ${cameraId}] Captured ${preRollSegments.length} pre-roll segments.`);

    // --- Monitor for new segments ---
    // This interval will run every second to add any *new* segments created by the live
    // streamer to our recording list.
    const monitorInterval = setInterval(() => {
        const currentState = getCameraState(cameraId);
        // We only care about the latest segment in the buffer.
        if (currentState.hlsSegmentBuffer.length > 0) {
            const latestSegment = currentState.hlsSegmentBuffer[currentState.hlsSegmentBuffer.length - 1];
            if (!segmentsToRecord.has(latestSegment.filename)) {
                // console.log(`[Webhook ${cameraId}] Adding new segment: ${latestSegment.filename}`);
                segmentsToRecord.add(latestSegment.filename);
            }
        }
    }, 1000);

    // --- Set up finalization timer ---
    const stopTimer = setTimeout(() => finalizeRecording(cameraId), CLIP_DURATION_SECONDS * 1000);

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const eventName = eventInfo.label ? `${eventInfo.type}-${eventInfo.label}` : eventInfo.type;
    const finalFilename = `webhook-rec-${eventName}-${timestamp}.mp4`;

    // --- Store recording state ---
    setWebhookRecording(cameraId, {
        stopTimer,
        monitorInterval,
        segmentsToRecord,
        eventInfo,
        finalFilename,
    });
}

// NOTE: SMS notification logic is omitted for brevity in this refactoring,
// but can be added back in easily.

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

    let eventData: EventInfo = { type: 'motion', label: 'unknown' };
    try {
        const payload = await req.json();
        eventData = {
            type: payload.type || 'motion',
            label: payload.label || 'no-label',
        };
    } catch (error) {
        console.warn('[Webhook] Could not parse event JSON, using fallback data.');
    }

    addEvent({ cameraId, ...eventData }).catch(err => console.error('[Webhook DB] Failed to save event:', err));

    const state = getCameraState(cameraId);
    if (state.webhookRecording) {
        // --- Extend existing recording ---
        console.log(`[Webhook ${cameraId}] Extending recording for event: ${eventData.label}`);
        // Clear the old timer and set a new one.
        clearTimeout(state.webhookRecording.stopTimer);
        const newStopTimer = setTimeout(() => finalizeRecording(cameraId), CLIP_DURATION_SECONDS * 1000);
        // Update the state with the new timer.
        setWebhookRecording(cameraId, { ...state.webhookRecording, stopTimer: newStopTimer });
        return NextResponse.json({ success: true, message: 'Recording extended.' });
    } else {
        // --- Start a new recording ---
        startNewWebhookRecording(camera, eventData);
        return NextResponse.json({ success: true, message: 'Recording triggered.' });
    }
}
