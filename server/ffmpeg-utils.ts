import { spawn } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';

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