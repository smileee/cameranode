import { NextRequest, NextResponse } from 'next/server';
import { addEvent } from '@/server/db';

/**
 * Production webhook handler – parses the incoming JSON payload and saves an
 * event to the database. Keeps concise console logs for visibility.
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

    try {
        await addEvent({
            cameraId: String(cameraId),
            type: 'detection',
            label,
            payload,
            status: 'pending',
        } as any);

        console.log(`[Webhook] Event saved for camera ${cameraId}: ${label}`);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[Webhook] Failed to save event:', error);
        return NextResponse.json({ error: 'Failed to save event' }, { status: 500 });
    }
}
