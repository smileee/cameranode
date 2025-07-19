import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { createInterface } from 'readline';
import { Camera, CAMERAS } from '../cameras.config';
import { setHlsStreamerProcess, addHlsSegment, getCameraState, cleanupAllProcesses } from './state';

const HLS_OUTPUT_DIR = 'recordings';
const HLS_SEGMENT_DURATION_SECONDS = 2; // Duration of each video segment in seconds.

// Keep a large playlist so ffmpeg doesn't delete segments too early. 
// 1 hour = 3600 seconds. 3600s / 2s/segment = 1800 segments. We'll use 2000 to be safe.
const HLS_LIST_SIZE = 2000;
const SEGMENT_BUFFER_RETENTION_MINUTES = 65; // Keep a little over an hour of segments on disk.
const PRE_ROLL_BUFFER_SIZE = 30; // Number of segments to keep for pre-roll (e.g., 30 segments * 2s = 60s buffer).

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

    // Clean up the live directory from previous runs.
    await fs.rm(liveDir, { recursive: true, force: true });
    await fs.mkdir(liveDir, { recursive: true });

    // The text to overlay on the video. Displays date and time.
    // We need to escape colons for the drawtext filter.
    const timestampText = '%{localtime\\:%Y-%m-%d %H\\\\\\:%M\\\\\\:%S}';

    const ffmpegArgs = [
        // Error Handling & Analysis
        '-err_detect', 'ignore_err', // Ignore all errors
        '-probesize', '5M',
        '-analyzeduration', '5M',
        '-fflags', '+genpts+discardcorrupt+nobuffer', // Generate timestamps, discard corrupted packets, and disable buffering

        // Input
        '-hide_banner',
        '-loglevel', 'error', // More verbose logs for debugging connection issues
        '-rtsp_transport', 'tcp',
        '-timeout', '10000000', // 10-second connection timeout
        '-i', camera.rtspUrl,

        // Video Filter for Timestamp
        '-vf', `drawtext=text='${timestampText}':fontcolor=white:fontsize=24:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/2:y=10`,

        // Output
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-pix_fmt', 'yuv420p', // Standard pixel format for H.264
        '-bsf:v', 'h264_mp4toannexb', // Bitstream filter for HLS
        '-an', // No audio

        // HLS options
        '-f', 'hls',
        '-hls_time', HLS_SEGMENT_DURATION_SECONDS.toString(),
        '-hls_list_size', HLS_LIST_SIZE.toString(),
        // We manage segment deletion manually to ensure they exist for the processor.
        '-hls_flags', 'program_date_time',
        '-hls_segment_filename', path.join(liveDir, 'segment%06d.ts'), // e.g., segment000001.ts
        path.join(liveDir, 'live.m3u8'),
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
