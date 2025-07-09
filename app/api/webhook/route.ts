import { NextRequest, NextResponse } from 'next/server';
import { getCameraState } from '@/server/state';
import { addEvent } from '@/server/db';

/**
 * Handles incoming webhook requests to trigger camera recordings.
 * This endpoint is designed to be called by an external service (e.g., Frigate)
 */
export async function POST(req: NextRequest) {
    console.log('[Webhook] Received a request.');
    
    // The camera ID should be part of the URL, e.g., /api/webhook/1?label=person
    const cameraId = req.nextUrl.searchParams.get('camera');
    const label = req.nextUrl.searchParams.get('label') || 'motion';

    if (!cameraId) {
        console.error('[Webhook] Request rejected: Camera ID is missing in the URL.');
        return NextResponse.json({ error: 'Camera ID is required' }, { status: 400 });
    }

    // Instead of triggering a recording, we just log the event.
    // The frontend will be responsible for initiating the video generation.
    await addEvent({
        cameraId,
        type: 'detection',
        label,
    });

    console.log(`[Webhook] Event '${label}' successfully logged for camera ${cameraId}.`);

    // We no longer trigger recordings from the webhook.
    // The old logic has been removed.
    
    return NextResponse.json({
        message: `Event '${label}' logged for camera ${cameraId}.`,
    });
}
