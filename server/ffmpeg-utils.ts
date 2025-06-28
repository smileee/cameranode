import { spawn } from 'child_process';
import path from 'path';

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