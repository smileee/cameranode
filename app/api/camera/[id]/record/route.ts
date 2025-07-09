import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import { getCameraState } from '@/server/state';
import { concatenateSegments, generateThumbnail } from '@/server/ffmpeg-utils';
import { addEvent } from '@/server/db';

const RECORDING_PRE_EVENT_SECONDS = 15;
const RECORDING_POST_EVENT_SECONDS = 45;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const cameraId = params.id;
    const { timestamp, label } = await req.json();

    if (!timestamp || !label) {
        return NextResponse.json({ error: 'Timestamp and label are required' }, { status: 400 });
    }

    const eventTime = new Date(timestamp).getTime();
    if (isNaN(eventTime)) {
        return NextResponse.json({ error: 'Invalid timestamp' }, { status: 400 });
    }

    const state = getCameraState(cameraId);
    const { hlsSegmentBuffer } = state;

    if (hlsSegmentBuffer.length === 0) {
        return NextResponse.json({ error: 'No video segments available to create recording' }, { status: 500 });
    }

    const startTime = eventTime - RECORDING_PRE_EVENT_SECONDS * 1000;
    const endTime = eventTime + RECORDING_POST_EVENT_SECONDS * 1000;

    const segmentsToInclude = hlsSegmentBuffer
        .filter(segment => segment.startTime >= startTime && segment.startTime <= endTime)
        .map(segment => segment.filename);

    if (segmentsToInclude.length === 0) {
        return NextResponse.json({ error: 'No video segments found for the requested time window' }, { status: 404 });
    }

    const liveDir = path.join(process.cwd(), 'recordings', cameraId, 'live');
    const outputDir = path.join(process.cwd(), 'recordings', cameraId);
    await fs.mkdir(outputDir, { recursive: true });
    
    const outputTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFileName = `rec-${label}-${outputTimestamp}.mp4`;
    const outputPath = path.join(outputDir, outputFileName);

    const success = await concatenateSegments(segmentsToInclude, liveDir, outputPath);

    if (!success) {
        return NextResponse.json({ error: 'Failed to create video file' }, { status: 500 });
    }
    
    await generateThumbnail(outputPath);

    // Create a new event to represent the generated video
    await addEvent({
        cameraId,
        type: 'recording',
        label: `recording-${label}`,
    });

    return NextResponse.json({
        message: 'Recording created successfully',
        filePath: outputPath,
    });
} 