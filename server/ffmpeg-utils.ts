import { spawn } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';
import { HlsSegment } from './state';

const resolveFfmpegPath = () => {
    try {
        return (eval('require'))('ffmpeg-static') as string;
    } catch (e) {
        console.warn('[Thumbnail] ffmpeg-static not found, falling back to system ffmpeg');
        return 'ffmpeg';
    }
};

const FFMPEG_PATH = resolveFfmpegPath();

/**
 * Generates a thumbnail for a given video file.
 * The thumbnail will be saved in the same directory as the video.
 * @param videoPath The full path to the video file.
 * @returns The path to the generated thumbnail, or null on failure.
 */
export async function generateThumbnail(videoPath: string): Promise<string | null> {
    // We will save the thumbnail right next to the video file, with the same name but a .jpg extension.
    const thumbnailPath = videoPath.replace(/.mp4$/, '.jpg');

    // Make sure we are not trying to create a thumbnail for a thumbnail
    if (thumbnailPath === videoPath) {
        console.error('Cannot generate thumbnail for a non-mp4 file:', videoPath);
        return null;
    }

    const ffmpegArgs = [
        '-i', videoPath,
        '-ss', '00:00:01.000', // Capture frame at 1 second to avoid black frames at the start
        '-vframes', '1',
        '-q:v', '3',          // A good balance of quality and size
        '-f', 'image2',
        '-y',                 // Overwrite if exists
        thumbnailPath,
    ];

    console.log(`[Thumbnail] Generating for ${videoPath}...`);

    return new Promise((resolve) => {
        const ffmpegProcess = spawn(FFMPEG_PATH, ffmpegArgs);

        ffmpegProcess.on('close', (code) => {
            if (code === 0) {
                console.log(`[Thumbnail] Generated successfully: ${thumbnailPath}`);
                resolve(thumbnailPath);
            } else {
                console.error(`[Thumbnail] Generation failed for ${videoPath} with exit code ${code}.`);
                resolve(null);
            }
        });

        ffmpegProcess.stderr.on('data', data => console.error(`[Thumbnail FFMPEG stderr]: ${data}`));
        
        ffmpegProcess.on('error', err => {
            console.error(`[Thumbnail] Failed to start ffmpeg process:`, err);
            resolve(null);
        });
    });
}

/**
 * Concatenates HLS segment files (.ts) into a single MP4 file.
 * @param segmentFiles - An array of the .ts filenames to concatenate, in order.
 * @param segmentsDir - The directory where the segment files are located.
 * @param outputPath - The full path for the output MP4 file.
 * @returns A boolean indicating whether the concatenation was successful.
 */
export async function concatenateSegments(segmentFiles: string[], segmentsDir: string, outputPath: string): Promise<boolean> {
    const manifestPath = path.join(segmentsDir, `manifest-${Date.now()}.txt`);
    const manifestContent = segmentFiles.map(file => `file '${path.join(segmentsDir, file)}'`).join('\n');

    try {
        await fs.writeFile(manifestPath, manifestContent);
    } catch (error) {
        console.error('[Concat] Failed to write temporary manifest file:', error);
        return false;
    }

    const ffmpegArgs = [
        '-f', 'concat',
        '-safe', '0',
        '-i', manifestPath,
        '-c', 'copy', // Direct copy, no re-encoding
        '-y',
        outputPath,
    ];

    console.log(`[Concat] Starting concatenation for ${outputPath}...`);

    return new Promise(async (resolve) => {
        const ffmpegProcess = spawn(FFMPEG_PATH, ffmpegArgs);

        ffmpegProcess.on('close', async (code) => {
            if (code === 0) {
                console.log(`[Concat] Concatenation successful: ${outputPath}`);
                resolve(true);
            } else {
                console.error(`[Concat] Concatenation failed for ${outputPath} with exit code ${code}.`);
                resolve(false);
            }
            // Cleanup the manifest file
            try {
                await fs.unlink(manifestPath);
            } catch (err) {
                console.warn(`[Concat] Failed to delete manifest file: ${manifestPath}`, err);
            }
        });

        ffmpegProcess.stderr.on('data', data => console.error(`[Concat FFMPEG stderr]: ${data.toString()}`));

        ffmpegProcess.on('error', async (err) => {
            console.error(`[Concat] Failed to start ffmpeg process:`, err);
            resolve(false);
            // Cleanup the manifest file
            try {
                await fs.unlink(manifestPath);
            } catch (unlinkErr) {
                console.warn(`[Concat] Failed to delete manifest file on error: ${manifestPath}`, unlinkErr);
            }
        });
    });
}

/**
 * A fire-and-forget function that orchestrates the finalization of a recording.
 * It concatenates segments and generates a thumbnail in the background.
 * @param cameraId The ID of the camera.
 * @param segmentsToRecord The list of segment filenames to include.
 * @param label The event label for naming the final file.
 */
export function finalizeAndSaveRecording(
    cameraId: string,
    segmentsToRecord: string[],
    label: string
) {
    console.log(`[Finalize] Starting background finalization for camera ${cameraId}, event: ${label}`);

    // This is a fire-and-forget process. We run it in the background
    // and don't await its completion to avoid blocking the main thread.
    (async () => {
        const uniqueSegments = [...new Set(segmentsToRecord)];
        if (uniqueSegments.length === 0) {
            console.warn(`[Finalize] No segments to record for camera ${cameraId}. Aborting.`);
            return;
        }

        const liveDir = path.join(process.cwd(), 'recordings', cameraId, 'live');
        const outputDir = path.join(process.cwd(), 'recordings', cameraId);
        await fs.mkdir(outputDir, { recursive: true });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFileName = `rec-${label}-${timestamp}.mp4`;
        const outputPath = path.join(outputDir, outputFileName);

        try {
            const success = await concatenateSegments(uniqueSegments, liveDir, outputPath);

            if (success) {
                console.log(`[Finalize] Successfully created video: ${outputPath}`);
                // Now, generate a thumbnail for the new video.
                await generateThumbnail(outputPath);
            } else {
                console.error(`[Finalize] Failed to create video for camera ${cameraId}.`);
            }
        } catch (error) {
            console.error(`[Finalize] An unexpected error occurred during finalization for camera ${cameraId}:`, error);
        }
    })();
} 

/**
 * Finds the most relevant video segment for a given event, copies it,
 * generates a thumbnail, and returns the public-facing paths.
 * @param eventId The ID of the event.
 * @param cameraId The ID of the camera.
 * @param eventTimestamp The timestamp of the event.
 * @param segmentBuffer The buffer of HLS segments to search through.
 * @returns An object with the paths to the video and thumbnail, or null on failure.
 */
export async function createRecordingFromEvent(
    eventId: string,
    cameraId: string,
    eventTimestamp: number,
    segmentBuffer: HlsSegment[]
): Promise<{ videoPath: string; thumbnailPath: string } | null> {
    
    if (segmentBuffer.length === 0) {
        console.warn(`[CreateRecording] No segments in buffer for event ${eventId}.`);
        return null;
    }

    // Find the segment that is closest to (but ideally just before) the event time.
    let bestSegment: HlsSegment | null = null;
    let smallestDiff = Infinity;

    for (const segment of segmentBuffer) {
        const diff = eventTimestamp - segment.startTime;
        if (diff >= 0 && diff < smallestDiff) {
            smallestDiff = diff;
            bestSegment = segment;
        }
    }

    if (!bestSegment) {
        console.warn(`[CreateRecording] Could not find a suitable segment for event ${eventId}. Using the latest one as a fallback.`);
        bestSegment = segmentBuffer[segmentBuffer.length - 1];
    }
    
    console.log(`[CreateRecording] Best segment for event ${eventId} is ${bestSegment.filename}`);

    const liveDir = path.join(process.cwd(), 'recordings', cameraId, 'live');
    const outputDir = path.join(process.cwd(), 'recordings', cameraId);
    await fs.mkdir(outputDir, { recursive: true });
    
    const sourceSegmentPath = path.join(liveDir, bestSegment.filename);
    const videoFileName = `rec-${eventId}.mp4`;
    const videoPath = path.join(outputDir, videoFileName);

    try {
        // We copy the .ts segment and rename it to .mp4. FFMPEG can handle this.
        await fs.copyFile(sourceSegmentPath, videoPath);

        console.log(`[CreateRecording] Successfully created video for event ${eventId}: ${videoPath}`);
        const thumbnailPath = await generateThumbnail(videoPath);
        
        if (thumbnailPath) {
            return {
                videoPath: `/api/media/${cameraId}/${videoFileName}`,
                thumbnailPath: `/api/media/${cameraId}/${path.basename(thumbnailPath)}`,
            };
        }
    } catch (error) {
        console.error(`[CreateRecording] An unexpected error occurred during creation for event ${eventId}:`, error);
    }

    return null;
} 