import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { createInterface } from 'readline';
import { Camera, CAMERAS } from '../cameras.config';
import { setHlsStreamerProcess, addHlsSegment, getCameraState, cleanupAllProcesses } from './state';

const HLS_OUTPUT_DIR = 'recordings';
const HLS_SEGMENT_DURATION_SECONDS = 6; // Duration of each video segment in seconds.

// Keep a large playlist so ffmpeg doesn't delete segments too early. 
// We need to adjust this based on the new segment duration.
// 1 hour = 3600 seconds. 3600s / 6s/segment = 600 segments. We'll use 800 to be safe.
const HLS_LIST_SIZE = 800;
const SEGMENT_BUFFER_RETENTION_MINUTES = 65; // Keep a little over an hour of segments on disk.
const PRE_ROLL_BUFFER_SIZE = 10; // Number of segments to keep for pre-roll (10 segments * 6s = 60s buffer).

/**
 * Periodically cleans up old HLS segment files for a given camera.
 * @param cameraId The ID of the camera to clean up.
 */
async function cleanupOldSegments(cameraId: string) {
    const liveDir = path.join(process.cwd(), HLS_OUTPUT_DIR, String(cameraId), 'live');
    try {
        const files = await fs.readdir(liveDir);
        const now = Date.now();
        const retentionMs = SEGMENT_BUFFER_RETENTION_MINUTES * 60 * 1000;

        for (const file of files) {
            if (file.endsWith('.ts')) {
                const filePath = path.join(liveDir, file);
                const stats = await fs.stat(filePath);
                if (now - stats.mtime.getTime() > retentionMs) {
                    await fs.unlink(filePath);
                    console.log(`[Cleanup ${cameraId}] Deleted old segment: ${file}`);
                }
            }
        }
    } catch (error: any) {
        // It's okay if the directory doesn't exist yet.
        if (error.code !== 'ENOENT') {
            console.error(`[Cleanup ${cameraId}] Error cleaning up old segments:`, error);
        }
    }
}
/**
 * Starts a persistent ffmpeg process for a single camera to generate an HLS stream.
 * @param camera - The camera configuration object.
 */
async function startHlsStreamForCamera(camera: Camera) {
    const cameraId = String(camera.id);
    const liveDir = path.join(process.cwd(), HLS_OUTPUT_DIR, cameraId, 'live');

    console.log(`[HLS ${cameraId}] Initializing stream. Output directory: ${liveDir}`);

    // --- Robust Directory Cleanup ---
    // Ensure the directory exists.
    await fs.mkdir(liveDir, { recursive: true });

    // Clean up files from previous runs inside the directory.
    try {
        const files = await fs.readdir(liveDir);
        for (const file of files) {
            await fs.unlink(path.join(liveDir, file));
        }
    } catch (error) {
        console.error(`[HLS ${cameraId}] Failed to clean up live directory contents:`, error);
        // We can still proceed, ffmpeg might just overwrite files.
    }

    // The text to overlay on the video. Displays date and time.
    // We need to escape colons for the drawtext filter.
    // REMOVED: This was causing instability with the camera's RTSP stream.
    // const timestampText = '%{localtime\\:%Y-%m-%d %H\\\\\\:%M\\\\\\:%S}';

    // Use copy codec only for camera 2 (Pi). Others reencode for better tolerance.
    const useCopy = camera.id === '2';

    const ffmpegArgs = useCopy ? [
        '-rtsp_transport','tcp',
        '-i', camera.rtspUrl,
        '-c:v','copy',
        '-an',
        '-f','hls',
        '-hls_time','2',
        '-hls_list_size','5',
        '-hls_flags','delete_segments',
        '-hls_segment_filename', path.join(liveDir,'segment%06d.ts'),
        path.join(liveDir,'live.m3u8'),
    ] : [
        '-rtsp_transport','tcp',
        '-timeout','10000000',
        '-i', camera.rtspUrl,
        '-c:v','libx264','-preset','veryfast','-tune','zerolatency',
        '-pix_fmt','yuv420p','-g','60',
        '-an',
        '-f','hls',
        '-hls_time','2',
        '-hls_list_size','5',
        '-hls_flags','delete_segments',
        '-hls_segment_filename', path.join(liveDir,'segment%06d.ts'),
        path.join(liveDir,'live.m3u8'),
    ];

    console.log(`[FFMPEG ${cameraId}] Spawning process: ffmpeg ${ffmpegArgs.join(' ')}`);

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
    setHlsStreamerProcess(cameraId, ffmpegProcess);
    
    // Use the readline interface for robust, line-by-line processing of the stream.
    // This correctly handles all forms of line breaks (\n, \r, \r\n) and partial data chunks.
    const rl = createInterface({
        input: ffmpegProcess.stderr,
        crlfDelay: Infinity
    });

    rl.on('line', (line) => {
        // Log the ffmpeg output here to ensure it's not consumed by a separate listener.
        // With loglevel at 'error', we should only see critical failure messages.
        console.log(`[FFMPEG_STDERR ${cameraId}]: ${line}`);

        // Use a simpler regex to be less strict about the line format.
        const match = line.match(/Opening '([^']+\.ts)' for writing/);
        
        if (match && match[1]) {
            console.log(`[Streamer ${cameraId}] Matched segment file: ${match[1]}`);
            const segmentPath = match[1];
            const segment = {
                filename: path.basename(segmentPath),
                path: segmentPath,
                startTime: Date.now(),
            };
            addHlsSegment(cameraId, segment, PRE_ROLL_BUFFER_SIZE);
        } else {
            // Log if a line doesn't match, to ensure we're not missing anything.
            // console.log(`[Streamer ${cameraId}] No match: ${line}`);
        }
    });

    // Start a periodic cleanup task for this camera's segments.
    // Runs every 5 minutes.
    setInterval(() => cleanupOldSegments(cameraId), 5 * 60 * 1000);

    ffmpegProcess.on('error', (err) => {
        console.error(`[FFMPEG_ERROR ${cameraId}] Process error:`, err);
    });

    ffmpegProcess.on('close', (code, signal) => {
        console.log(`[FFMPEG_CLOSE ${cameraId}] Process exited with code ${code} and signal ${signal}.`);
        
        const state = getCameraState(cameraId);
        // Only restart if the process was not intentionally killed.
        if (state.hlsStreamerProcess) { 
            console.log(`[FFMPEG_RESTART ${cameraId}] Restarting in 10s.`);
            setTimeout(() => startHlsStreamForCamera(camera), 10000);
        } else {
            console.log(`[FFMPEG_CLOSE ${cameraId}] Process was intentionally stopped. Will not restart.`);
        }
    });
}

/**
 * Initializes the HLS streaming processes for all configured cameras.
 */
export function initializeCameraStreams() {
    console.log('[Streamer] Initializing HLS streams for all cameras...');
    for (const camera of CAMERAS) {
        startHlsStreamForCamera(camera).catch(err => {
            console.error(`[Streamer] Failed to initialize stream for camera ${camera.id}:`, err);
        });
    }
}

// Graceful shutdown logic to clean up all ffmpeg processes.
process.on('SIGINT', () => {
    console.log('[Streamer] Received SIGINT. Shutting down gracefully.');
    cleanupAllProcesses();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('[Streamer] Received SIGTERM. Shutting down gracefully.');
    cleanupAllProcesses();
    process.exit(0);
});
