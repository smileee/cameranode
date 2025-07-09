import { NextRequest, NextResponse } from 'next/server';
import { getEventsForCamera } from '@/server/db';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const cameraId = searchParams.get('cameraId');

    if (!cameraId) {
        return NextResponse.json({ error: 'Camera ID is required' }, { status: 400 });
    }

    try {
        const events = await getEventsForCamera(cameraId);
        return NextResponse.json(events);
    } catch (error) {
        console.error(`[API/events] Failed to fetch events for camera ${cameraId}:`, error);
        return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }
} 