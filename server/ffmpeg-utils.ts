// server/ffmpeg-utils.ts

import path from 'path';
import { spawn } from 'child_process';
import { Camera } from '@/cameras.config';

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