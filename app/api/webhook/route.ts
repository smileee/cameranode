import { NextRequest, NextResponse } from 'next/server';
import { addEvent, getCameraSettings } from '@/server/db'; // Import getCameraSettings
import { CAMERAS, SPEAKERS } from '@/cameras.config';
import { cleanupRecordings } from '@/server/ffmpeg-utils';

/**
 * After an event is saved, trigger the finalization of its recording.
 * This is a fire-and-forget call to our own API.
 */
function triggerFinalization(eventId: string, req: NextRequest) {
  const host = req.headers.get('host');
  const protocol = req.headers.get('x-forwarded-proto') || 'http';
  const url = `${protocol}://${host}/api/events/${eventId}/finalize`;

  console.log(`[Webhook] Triggering finalization for event ${eventId} at ${url}`);

  // We don't await this, we want it to run in the background.
  fetch(url, { method: 'POST' }).catch((err) => {
    console.error(`[Webhook] Failed to trigger finalization for event ${eventId}:`, err);
  });
}

/**
 * Sends a request to the alert speaker for an animal. This is a fire-and-forget call.
 */
async function triggerAnimalAlert(animal: 'dog' | 'bird', duration: number) {
    const speaker = SPEAKERS[0];
    if (!speaker) {
        console.log('[Alert] No speaker configured, skipping.');
        return;
    }

    const url = `${speaker.rtspUrl}/alert`;
    const payload = {
        animal: animal,
        duration: duration,
    };

    console.log(`[Alert] Triggering '${animal}' alert to ${url} for ${duration}s`);

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const errorBody = await res.text();
            console.error(
                `[Alert] Failed to trigger animal alert. Speaker responded with ${res.status}: ${errorBody}`
            );
        }
    } catch (error) {
        console.error(`[Alert] Network error while triggering animal alert:`, error);
    }
}

/**
 * Sends a request to the speaker to make a simple beep.
 */
async function triggerPersonBeep() {
    const speaker = SPEAKERS[0];
    if (!speaker) {
        console.log('[Alert] No speaker configured, skipping.');
        return;
    }

    const url = `${speaker.rtspUrl}/beep`;
    const payload = {
        freq: 4000,
        ms: 150,
        times: 2,
    };

    console.log(`[Alert] Triggering 'person' beep to ${url}`);

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const errorBody = await res.text();
            console.error(
                `[Alert] Failed to trigger person beep. Speaker responded with ${res.status}: ${errorBody}`
            );
        }
    } catch (error) {
        console.error(`[Alert] Network error while triggering person beep:`, error);
    }
}

/**
 * Production webhook handler – parses the incoming JSON payload and saves an
 * event to the database.
 */
export async function POST(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const cameraId = searchParams.get('id');

    if (!cameraId) {
        console.warn('[Webhook] Missing ?id= query param');
        return NextResponse.json({ error: 'Camera id is required as ?id=' }, { status: 400 });
    }

    let payload: any;
    try {
        payload = await req.json();
    } catch (err) {
        console.warn('[Webhook] Invalid JSON payload:', err);
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (!payload || typeof payload !== 'object') {
        console.warn('[Webhook] Empty or non-object payload');
        return NextResponse.json({ error: 'Empty JSON body' }, { status: 400 });
    }

    // Basic validation – we at least expect a label.
    const label: string = payload.label ?? 'unknown';

    // Get camera-specific alert settings
    const settings = await getCameraSettings();
    const cameraSetting = settings[cameraId];

    // Trigger alert only if enabled for this camera and this label
    if (cameraSetting) {
        if (label === 'dog' && cameraSetting.dog) {
            triggerAnimalAlert('dog', 30);
        } else if (label === 'bird' && cameraSetting.bird) {
            triggerAnimalAlert('bird', 30);
        } else if (label === 'person' && cameraSetting.person) {
            triggerPersonBeep();
        }
    }

    try {
        const newEvent = await addEvent({
            cameraId: String(cameraId),
            type: 'detection',
            label,
            payload,
            status: 'pending',
        });

        // After the event is successfully saved, trigger the finalization process.
        triggerFinalization(newEvent.id, req);

        // Also trigger a cleanup of old recordings for this camera
        const camera = CAMERAS.find(c => c.id === cameraId);
        if (camera) {
            cleanupRecordings(camera);
        }

        console.log(`[Webhook] Event saved for camera ${cameraId}: ${label} (id: ${newEvent.id})`);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[Webhook] Failed to save event:', error);
        return NextResponse.json({ error: 'Failed to save event' }, { status: 500 });
    }
}
