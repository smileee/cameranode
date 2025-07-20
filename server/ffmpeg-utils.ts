// server/ffmpeg-utils.ts

import path from 'path';
import { spawn } from 'child_process';
import { Camera } from '../cameras.config';
import fs from 'fs';

// Constants for HLS streaming
const HLS_SEGMENT_DURATION_SECONDS = 2; // Duration of each segment in seconds
const HLS_MAX_SEGMENTS_IN_PLAYLIST = 5; // Number of segments to keep in the playlist

/**
 * Generates the arguments for the ffmpeg command.
 * It's configured to be resilient to common RTSP stream issues
 * and to output a standard HLS stream.
 * 
 * @param {string} rtspUrl The RTSP URL of the camera feed.
 * @param {string} hlsOutputPath The path to the directory where HLS files will be saved.
 * @returns {string[]} An array of arguments for ffmpeg.
 */
export function getFfmpegArgs(rtspUrl: string, hlsOutputPath: string) {
    const args = [
        // Input options - simplified for robustness
        '-rtsp_transport', 'tcp',
        '-i', rtspUrl,

        // Video options
        '-c:v', 'copy', // Copy the stream directly to avoid re-encoding errors

        // Audio options
        '-an', // No audio

        // HLS options
        '-f', 'hls',
        '-hls_time', String(HLS_SEGMENT_DURATION_SECONDS),
        '-hls_list_size', String(HLS_MAX_SEGMENTS_IN_PLAYLIST),
        '-hls_flags', 'delete_segments',
        '-hls_segment_filename', path.join(hlsOutputPath, 'segment%06d.ts'),
        path.join(hlsOutputPath, 'live.m3u8')
    ];

    return args;
}

/**
 * Creates a thumbnail from the first frame of a video file.
 * This is used to create a preview image for the camera card.
 * 
 * @param {string} videoPath The path to the video file.
 * @param {string} thumbnailPath The path where the thumbnail will be saved.
 * @returns {Promise<string | null>} The path to the thumbnail, or null if it failed.
 */
export async function createThumbnail(videoPath: string, thumbnailPath: string): Promise<string | null> {
    return new Promise((resolve) => {
        const ffmpegArgs = [
            '-i', videoPath,
            '-vf', 'thumbnail,scale=320:-1',
            '-frames:v', '1',
            thumbnailPath,
            '-y' // Overwrite if exists
        ];

        const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

        ffmpegProcess.stderr.on('data', (data) => {
            console.log(`[Thumbnail FFMPEG stderr]: ${data}`);
        });

        ffmpegProcess.on('close', (code) => {
            if (code === 0) {
                console.log(`[Thumbnail] Created successfully: ${thumbnailPath}`);
                resolve(thumbnailPath);
            } else {
                console.error(`[Thumbnail] ffmpeg exited with code ${code}`);
                resolve(null);
            }
        });

        ffmpegProcess.on('error', (err) => {
            console.error('[Thumbnail] Failed to start ffmpeg process:', err);
            resolve(null);
        });
    });
}

/**
 * Concatenates HLS segments into a single MP4 file.
 * @param segmentPaths - An array of paths to the HLS segment files.
 * @param outputPath - The path to save the final MP4 file.
 */
export async function concatenateSegments(segmentPaths: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', `concat:${segmentPaths.join('|')}`,
            '-c', 'copy',
            '-movflags', 'faststart',
            outputPath
        ]);

        ffmpeg.stderr.on('data', (data) => {
            console.error(`[FFMPEG CONCAT]: ${data}`);
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                console.log('[FFMPEG CONCAT] Concatenation successful.');
                resolve();
            } else {
                reject(new Error(`[FFMPEG CONCAT] Exited with code ${code}`));
            }
        });

        ffmpeg.on('error', (err) => {
            reject(new Error(`[FFMPEG CONCAT] Failed to start process: ${err.message}`));
        });
    });
}

/**
 * Generates a thumbnail from a video file.
 * @param videoPath - Path to the video file.
 * @param outputPath - Path to save the thumbnail.
 */
export async function generateThumbnail(videoPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', videoPath,
            '-ss', '00:00:01', // Take thumbnail at 1 second
            '-vframes', '1',
            '-vf', 'scale=320:-1', // Resize to 320px width, auto height
            outputPath
        ]);

        ffmpeg.stderr.on('data', (data) => {
            console.error(`[FFMPEG THUMBNAIL]: ${data}`);
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                console.log('[FFMPEG THUMBNAIL] Thumbnail generated successfully.');
                resolve();
            } else {
                reject(new Error(`[FFMPEG THUMBNAIL] Exited with code ${code}`));
            }
        });

        ffmpeg.on('error', (err) => {
            reject(new Error(`[FFMPEG THUMBNAIL] Failed to start process: ${err.message}`));
        });
    });
}

export async function createRecordingFromEvent(
    eventId: string,
    cameraId: string,
    eventTimestamp: number,
  segmentBuffer: any[]
): Promise<{ videoPath: string; thumbnailPath: string } | null> {
  // Stub: recording creation disabled for now
  console.warn('[createRecordingFromEvent] Stub called - not implemented');
    return null;
} 

/**
 * Checks the total size of recordings for a camera and deletes the oldest ones
 * if the storage limit is exceeded.
 * @param {Camera} camera - The camera object, including the storageLimitGB.
 */
export async function cleanupRecordings(camera: Camera): Promise<void> {
    if (camera.storageLimitGB === undefined || camera.storageLimitGB <= 0) {
        console.log(`[Cleanup ${camera.id}] No storage limit set, skipping cleanup.`);
        return;
    }

    const recordingsDir = path.join(process.cwd(), 'recordings', camera.id);
    const limitBytes = camera.storageLimitGB * 1024 * 1024 * 1024;

    try {
        if (!fs.existsSync(recordingsDir)) {
            return;
        }
        
        const files = fs.readdirSync(recordingsDir)
            .filter(file => file.endsWith('.mp4'))
            .map(file => {
                const filePath = path.join(recordingsDir, file);
                const stats = fs.statSync(filePath);
                return { path: filePath, size: stats.size, mtime: stats.mtime };
            })
            // Sort by modification time, oldest first
            .sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

        let totalSize = files.reduce((acc, file) => acc + file.size, 0);

        if (totalSize > limitBytes) {
            console.log(`[Cleanup ${camera.id}] Storage limit exceeded. Total: ${(totalSize / (1024*1024*1024)).toFixed(2)}GB, Limit: ${camera.storageLimitGB}GB. Cleaning up...`);
            
            for (const file of files) {
                if (totalSize <= limitBytes) {
                    break;
                }
                console.log(`[Cleanup ${camera.id}] Deleting old recording: ${path.basename(file.path)}`);
                fs.unlinkSync(file.path);
                totalSize -= file.size;
            }
            
            console.log(`[Cleanup ${camera.id}] Cleanup complete. New total size: ${(totalSize / (1024*1024*1024)).toFixed(2)}GB`);
        }
        
    } catch (error) {
        console.error(`[Cleanup ${camera.id}] Error during cleanup:`, error);
    }
} 