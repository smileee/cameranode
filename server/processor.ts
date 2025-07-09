import fs from 'fs/promises';
import path from 'path';
import { getDB, updateEvent, Event } from './db';
import { getCameraState } from './state';
import { concatenateSegments } from './ffmpeg-utils';

const HLS_OUTPUT_DIR = 'recordings';
const RECORDING_DURATION_SECONDS = 60; // Generate 1-minute videos
const PRE_ROLL_SECONDS = 30; // Include 30 seconds before the event
const PROCESSING_INTERVAL_MS = 10000; // Check for new events every 10 seconds

let isProcessing = false;

/**
 * Finds the HLS segment file that is closest to a given timestamp.
 * @param segmentDir The directory containing the HLS segments.
 * @param targetTimestamp The timestamp of the event.
 * @returns The path to the best matching segment file or null.
 */
async function findClosestSegment(segmentDir: string, targetTimestamp: Date): Promise<string | null> {
    let closestSegment: string | null = null;
    let smallestDiff = Infinity;

    try {
        const files = await fs.readdir(segmentDir);
        for (const file of files.filter(f => f.endsWith('.ts'))) {
            const filePath = path.join(segmentDir, file);
            const stats = await fs.stat(filePath);
            // The segment's start time is its modification time.
            const diff = Math.abs(stats.mtime.getTime() - targetTimestamp.getTime());

            if (diff < smallestDiff) {
                smallestDiff = diff;
                closestSegment = filePath;
            }
        }
    } catch (error: any) {
        if (error.code !== 'ENOENT') {
            console.error(`[Processor] Error reading segment directory ${segmentDir}:`, error);
        }
        return null; // Directory might not exist yet, which is fine.
    }
    
    return closestSegment;
}


/**
 * Processes pending detection events to generate video recordings.
 */
async function processPendingEvents() {
    if (isProcessing) {
        console.log('[Processor] Skipping run because a previous run is still in progress.');
        return;
    }
    isProcessing = true;
    console.log('[Processor] Starting to process pending events...');

    try {
        const db = await getDB();
        const pendingEvents = db.data.events.filter((e: Event) => e.status === 'pending');

        if (pendingEvents.length === 0) {
            console.log('[Processor] No pending events to process.');
            return;
        }

        for (const event of pendingEvents) {
            console.log(`[Processor] Processing event ${event.id} for camera ${event.cameraId}`);
            const cameraState = getCameraState(event.cameraId);
            if (!cameraState || cameraState.hlsSegmentBuffer.length === 0) {
                console.warn(`[Processor] No camera state or segment buffer for camera ${event.cameraId}. Skipping event.`);
                continue;
            }

            const liveDir = path.join(process.cwd(), HLS_OUTPUT_DIR, event.cameraId, 'live');
            const eventTimestamp = new Date(event.timestamp);
            
            // Find the segment that is closest to the event time. This will be our anchor.
            const anchorSegment = await findClosestSegment(liveDir, eventTimestamp);

            if (!anchorSegment) {
                console.warn(`[Processor] Could not find a suitable anchor segment for event ${event.id}. It might be too old. Skipping.`);
                await updateEvent(event.id, { status: 'processed', videoPath: 'error-segment-not-found' });
                continue;
            }
            
            // From the list of all available segments, find the index of our anchor.
            const allSegments = (await fs.readdir(liveDir))
                .filter(f => f.endsWith('.ts'))
                .sort()
                .map(f => path.join(liveDir, f));

            const anchorIndex = allSegments.findIndex(s => s === anchorSegment);

            if (anchorIndex === -1) {
                console.error(`[Processor] Logic error: Anchor segment ${anchorSegment} not found in sorted list. Skipping event ${event.id}.`);
                continue;
            }

            // Calculate the range of segments to include for the final video.
            const segmentDuration = 2; // This should match the streamer config.
            const preRollSegments = Math.ceil(PRE_ROLL_SECONDS / segmentDuration);
            const postRollSegments = Math.ceil((RECORDING_DURATION_SECONDS - PRE_ROLL_SECONDS) / segmentDuration);

            const startIndex = Math.max(0, anchorIndex - preRollSegments);
            const endIndex = Math.min(allSegments.length, anchorIndex + postRollSegments);

            const segmentsToConcatenate = allSegments.slice(startIndex, endIndex);

            if (segmentsToConcatenate.length < (preRollSegments + postRollSegments) / 2) {
                 console.warn(`[Processor] Not enough segments available for event ${event.id}. Needed ~${preRollSegments+postRollSegments}, found ${segmentsToConcatenate.length}. Skipping.`);
                 continue;
            }

            const outputFileName = `rec-${event.timestamp.replace(/:/g, '-')}.mp4`;
            const outputDir = path.join(process.cwd(), HLS_OUTPUT_DIR, event.cameraId, 'recordings');
            await fs.mkdir(outputDir, { recursive: true });
            const outputPath = path.join(outputDir, outputFileName);
            
            console.log(`[Processor] Generating video for event ${event.id} at ${outputPath}`);

            try {
                await concatenateSegments(segmentsToConcatenate, outputPath);
                await updateEvent(event.id, { status: 'processed', videoPath: outputPath });
                console.log(`[Processor] Successfully generated video for event ${event.id}`);
            } catch (error) {
                console.error(`[Processor] Failed to generate video for event ${event.id}:`, error);
                await updateEvent(event.id, { status: 'processed', videoPath: 'error-concatenation-failed' });
            }
        }
    } catch (error) {
        console.error('[Processor] An unexpected error occurred during event processing:', error);
    } finally {
        isProcessing = false;
        console.log('[Processor] Finished processing pending events.');
    }
}

/**
 * Starts the background processing service.
 */
export function startProcessor() {
    console.log('[Processor] Starting background processor...');
    setInterval(processPendingEvents, PROCESSING_INTERVAL_MS);
} 