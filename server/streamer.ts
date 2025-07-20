import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { createInterface } from 'readline';
import { Camera, CAMERAS } from '../cameras.config';
import { setHlsStreamerProcess, addHlsSegment, getCameraState, cleanupAllProcesses } from './state';

const HLS_OUTPUT_DIR = 'recordings';
const HLS_SEGMENT_DURATION_SECONDS = 4; // Increased from 2 to 4 seconds for better stability

// Keep a large playlist so ffmpeg doesn't delete segments too early. 
// We need to adjust this based on the new segment duration.
// 1 hour = 3600 seconds. 3600s / 4s/segment = 900 segments. We'll use 1000 to be safe.
const HLS_LIST_SIZE = 1000;
const SEGMENT_BUFFER_RETENTION_MINUTES = 65; // Keep a little over an hour of segments on disk.
const PRE_ROLL_BUFFER_SIZE = 15; // Number of segments to keep for pre-roll (15 segments * 4s = 60s buffer).

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
 * Creates a mock HLS stream using a test pattern for development
 */
async function createMockHlsStream(cameraId: string, liveDir: string) {
    console.log(`[HLS ${cameraId}] Creating mock stream for development...`);
    
    // Generate test pattern segments
    const segmentDuration = 4;
    const totalDuration = 120; // 2 minutes of mock content
    const numSegments = Math.floor(totalDuration / segmentDuration);
    
    // Create mock playlist
    const playlistContent = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        `#EXT-X-TARGETDURATION:${segmentDuration}`,
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXT-X-PLAYLIST-TYPE:EVENT'
    ];
    
    for (let i = 0; i < numSegments; i++) {
        playlistContent.push(`#EXTINF:${segmentDuration}.0,`);
        playlistContent.push(`mock_segment${String(i).padStart(6, '0')}.ts`);
    }
    
    const playlistPath = path.join(liveDir, 'live.m3u8');
    await fs.writeFile(playlistPath, playlistContent.join('\n'));
    
    // Create mock segments with test pattern
    for (let i = 0; i < Math.min(5, numSegments); i++) {
        const segmentPath = path.join(liveDir, `mock_segment${String(i).padStart(6, '0')}.ts`);
        // Create a small dummy file (in production this would be actual video)
        await fs.writeFile(segmentPath, Buffer.alloc(1024, 0));
        
        // Add to segment buffer
        const segment = {
            filename: `mock_segment${String(i).padStart(6, '0')}.ts`,
            path: segmentPath,
            startTime: Date.now() - (i * 1000), // Stagger timestamps
        };
        addHlsSegment(cameraId, segment, PRE_ROLL_BUFFER_SIZE);
    }
    
    console.log(`[HLS ${cameraId}] Mock stream created with ${numSegments} segments`);
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

    // Check if camera is enabled
    if (camera.enabled === false) {
        console.log(`[HLS ${cameraId}] Camera is disabled, skipping`);
        return;
    }

    const SEG_DUR = '4'; // Increased from 2 to 4 seconds
    const PLAYLIST_SZ = '25'; // 25×4s = 100s de buffer (increased from 12×2s = 24s)
    const HLS_FLAGS = 'program_date_time+delete_segments+append_list';

    let ffmpegArgs;

    if (camera.mock) {
        console.log(`[HLS ${cameraId}] Using mock stream for development`);
        await createMockHlsStream(cameraId, liveDir);
        return; // Don't start ffmpeg for mock cameras
    } else {
         ffmpegArgs = [
            '-rtsp_transport','tcp',
            '-analyzeduration', '10M', // Analyze 10MB of data to better determine stream properties
            '-probesize', '10M',      // Probe 10MB of data to identify streams
            '-err_detect', 'ignore_err', // Ignore errors in the input stream
            '-fflags', '+genpts+discardcorrupt', // Regenerate timestamps and discard corrupted frames
            '-i', camera.rtspUrl,
            '-c:v','libx264','-preset','veryfast','-tune','zerolatency',
            '-pix_fmt','yuv420p','-g','120','-an',
            '-b:v','1000k','-maxrate','1500k','-bufsize','2000k',
            '-profile:v','main','-level','4.1',
            '-strict', '-2', // Allow use of experimental codecs/features if needed
            '-f','hls',
            '-hls_time', SEG_DUR,
            '-hls_list_size', PLAYLIST_SZ,
            '-hls_flags', HLS_FLAGS,
            '-hls_segment_filename',
            `${liveDir}/segment%06d.ts`,
            '-hls_segment_type',
            'mpegts',
            '-hls_allow_cache',
            '0',
            `${liveDir}/live.m3u8`
        ];
    }
    
    console.log(`[FFMPEG ${cameraId}] Spawning process: ffmpeg ${ffmpegArgs.join(' ')}`);

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
        // Add environment variables for better stability
        env: {
            ...process.env,
            'FFREPORT': `file=ffmpeg-${cameraId}.log:level=32`, // Enable detailed logging
        }
    });
    
    setHlsStreamerProcess(cameraId, ffmpegProcess);
    
    // Use the readline interface for robust, line-by-line processing of the stream.
    // This correctly handles all forms of line breaks (\n, \r, \r\n) and partial data chunks.
    const rl = createInterface({
        input: ffmpegProcess.stderr,
        crlfDelay: Infinity
    });

    let lastSegmentTime = Date.now();
    let consecutiveErrors = 0;

    rl.on('line', (line) => {
        // Log the ffmpeg output here to ensure it's not consumed by a separate listener.
        // With loglevel at 'error', we should only see critical failure messages.
        console.log(`[FFMPEG_STDERR ${cameraId}]: ${line}`);

        // Check for connection errors
        if (line.includes('Connection refused') || line.includes('Connection timed out') || line.includes('Network is unreachable')) {
            consecutiveErrors++;
            console.error(`[FFMPEG ${cameraId}] Connection error (${consecutiveErrors}): ${line}`);
            
            // If we have too many consecutive errors, restart the process
            if (consecutiveErrors > 5) {
                console.error(`[FFMPEG ${cameraId}] Too many consecutive errors, restarting process...`);
                ffmpegProcess.kill('SIGTERM');
                return;
            }
        } else {
            // Reset error counter on successful output
            consecutiveErrors = 0;
        }

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
            lastSegmentTime = Date.now();
        } else {
            // Log if a line doesn't match, to ensure we're not missing anything.
            // console.log(`[Streamer ${cameraId}] No match: ${line}`);
        }
    });

    // Monitor for segment generation timeout
    const segmentMonitor = setInterval(() => {
        const timeSinceLastSegment = Date.now() - lastSegmentTime;
        if (timeSinceLastSegment > 30000) { // 30 seconds without new segments
            console.warn(`[FFMPEG ${cameraId}] No new segments for ${timeSinceLastSegment}ms, restarting...`);
            ffmpegProcess.kill('SIGTERM');
            clearInterval(segmentMonitor);
        }
    }, 10000); // Check every 10 seconds

    // Start a periodic cleanup task for this camera's segments.
    // Runs every 5 minutes.
    setInterval(() => cleanupOldSegments(cameraId), 5 * 60 * 1000);

    ffmpegProcess.on('error', (err) => {
        console.error(`[FFMPEG_ERROR ${cameraId}] Process error:`, err);
        consecutiveErrors++;
    });

    ffmpegProcess.on('close', (code, signal) => {
        console.log(`[FFMPEG_CLOSE ${cameraId}] Process exited with code ${code} and signal ${signal}.`);
        clearInterval(segmentMonitor);
        
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
