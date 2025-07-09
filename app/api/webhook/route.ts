import { NextRequest, NextResponse } from 'next/server';
import { CAMERAS } from '@/cameras.config';
import { addEvent } from '@/server/db';
import { triggerRecording, getCameraState } from '@/server/state';
import { finalizeAndSaveRecording } from '@/server/ffmpeg-utils';

type EventInfo = { type: string; label?: string };

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

    // Persist the event to the database (fire-and-forget)
    addEvent({ cameraId, ...eventData }).catch(err =>
        console.error('[Webhook DB] Failed to save event:', err)
    );

    const eventLabel = eventData.label || eventData.type;
    const session = getCameraState(cameraId).recordingSession;

    // Check if a recording is already in progress before defining the callback.
    // This is for logging purposes and to return a meaningful message.
    const wasAlreadyRecording = session.isRecording;

    // Define the callback function that will be executed when the recording timer finishes.
    // This function now receives the segments and label directly to avoid race conditions.
    const finalizeCallback = (segments: string[], label: string) => {
        // This function runs in the background (fire-and-forget)
        finalizeAndSaveRecording(cameraId, segments, label);
    };

    // Trigger a new recording. The state manager prevents duplicates.
    triggerRecording(
        cameraId,
        eventLabel,
        finalizeCallback,
    );

    const message = wasAlreadyRecording
        ? 'Recording already in progress. Trigger ignored.'
        : 'New recording triggered.';

    return NextResponse.json({ success: true, message });
}
