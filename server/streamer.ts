import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { Camera, CAMERAS } from '../cameras.config';
import { setHlsStreamerProcess, addHlsSegment, getCameraState, cleanupAllProcesses } from './state';

const HLS_OUTPUT_DIR = 'recordings';
const HLS_SEGMENT_DURATION_SECONDS = 2; // Duration of each video segment in seconds.
const HLS_LIST_SIZE = 5; // Number of segments to keep in the live playlist.
const PRE_ROLL_BUFFER_SIZE = 15; // Number of segments to keep for pre-roll (e.g., 15 segments * 2s = 30s buffer).

/**
 * Starts a persistent ffmpeg process for a single camera to generate an HLS stream.
 * @param camera - The camera configuration object.
 */
async function startHlsStreamForCamera(camera: Camera) {
    const cameraId = camera.id;
    const liveDir = path.join(process.cwd(), HLS_OUTPUT_DIR, cameraId, 'live');

    console.log(`[HLS ${cameraId}] Initializing stream. Output directory: ${liveDir}`);

    // Clean up the live directory from previous runs.
    await fs.rm(liveDir, { recursive: true, force: true });
    await fs.mkdir(liveDir, { recursive: true });

    const ffmpegArgs = [
        '-rtsp_transport', 'tcp',
        '-i', camera.rtspUrl,
        '-c:v', 'copy',           // No re-encoding, direct copy of the video stream.
        '-an',                    // No audio.
        '-f', 'hls',
        '-hls_time', HLS_SEGMENT_DURATION_SECONDS.toString(),
        '-hls_list_size', HLS_LIST_SIZE.toString(),
        '-hls_flags', 'delete_segments+program_date_time', // Auto-delete old segments and add timestamps.
        '-hls_segment_filename', path.join(liveDir, 'segment%06d.ts'), // e.g., segment000001.ts
        path.join(liveDir, 'live.m3u8'),
    ];

    console.log(`[FFMPEG ${cameraId}] Spawning process: ffmpeg ${ffmpegArgs.join(' ')}`);

    // We explicitly ignore stdout and only listen to stderr to prevent the process from hanging.
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, { stdio: ['ignore', 'ignore', 'pipe'] });

    // Store the process in the global state.
    setHlsStreamerProcess(cameraId, ffmpegProcess);

    let buffer = '';
    ffmpegProcess.stderr.on('data', (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last partial line in the buffer

        for (const line of lines) {
            // Log the raw output for debugging, but only if it's not just whitespace.
            if (line.trim()) {
                console.error(`[FFMPEG_STDERR ${cameraId}]: ${line.trim()}`);
            }

            // Check for the "Opening... for writing" message which indicates a new segment file.
            if (line.includes("Opening '") && line.includes(".ts' for writing")) {
                const match = line.match(/Opening '([^']+)' for writing/);
                if (match && match[1]) {
                    const segmentPath = match[1];
                    const segment = {
                        filename: path.basename(segmentPath),
                        path: segmentPath,
                        startTime: Date.now(),
                    };
                    addHlsSegment(cameraId, segment);
                }
            }
        }
    });

    ffmpegProcess.on('error', (err) => {
        console.error(`[FFMPEG_ERROR ${cameraId}] Process error:`, err);
    });

    ffmpegProcess.on('close', (code, signal) => {
        console.error(`[FFMPEG_CLOSE ${cameraId}] Process exited with code ${code}, signal ${signal}. Restarting in 10s.`);
        // Don't restart if the process was intentionally killed.
        const state = getCameraState(cameraId);
        if (state.hlsStreamerProcess) { // Check if it was killed by our cleanup logic
            setTimeout(() => startHlsStreamForCamera(camera), 10000);
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
