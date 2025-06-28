import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CAMERAS } from '@/cameras.config';
import fs from 'fs/promises';
import path from 'path';
import LibraryClient from './client';

interface MediaFile {
    video: string;
    thumbnail: string;
}

async function getMediaFiles(cameraId: string) {
    const recordingsDir = path.join(process.cwd(), 'recordings', cameraId);
    const screenshotsDir = path.join(process.cwd(), 'screenshots', cameraId);

    const readDir = async (dir: string, prefix: string) => {
        try {
            const files = await fs.readdir(dir);
            return files.map(f => ({ name: f, path: path.join(prefix, f) }));
        } catch (error: any) {
            if (error.code === 'ENOENT') return [];
            throw error;
        }
    };
    
    const recordingFiles = await readDir(recordingsDir, 'recordings');
    const screenshotFiles = await readDir(screenshotsDir, 'screenshots');
    
    const allFiles = [...recordingFiles, ...screenshotFiles];

    // Get all thumbnails (jpgs) and sort them by name descending (newest first)
    const allThumbnails = allFiles
        .filter(file => file.name.endsWith('.jpg'))
        .sort((a, b) => b.name.localeCompare(a.name));


    const mediaItems = allThumbnails.map(thumb => {
        const videoPath = thumb.path.replace('.jpg', '.mp4');
        const hasVideo = allFiles.some(f => f.path === videoPath);
        
        return {
            thumbnail: thumb.path,
            video: hasVideo ? videoPath : null,
        };
    });

    return { mediaItems };
}


export default async function LibraryPage({ params }: { params: { id:string } }) {
    const camera = CAMERAS.find(c => c.id === params.id);

    if (!camera) {
        notFound();
    }

    const { mediaItems } = await getMediaFiles(camera.id);

    return (
        <main className="min-h-screen w-full bg-black text-white">
            <div className="container mx-auto px-4 py-8">
                <div className="mb-6">
                    <Link href={`/camera/${camera.id}`} className="text-gray-400 hover:text-gray-300">
                        &larr; Voltar para a Câmera
                    </Link>
                </div>
                <h1 className="text-4xl font-bold mb-8">Biblioteca da {camera.name}</h1>
                
                <LibraryClient 
                    cameraId={camera.id}
                    items={mediaItems}
                />

            </div>
        </main>
    );
} 