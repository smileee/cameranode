import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request, { params }: { params: { id: string } }) {
    const { id: cameraId } = params;
    const recordingsDir = path.join(process.cwd(), 'recordings', cameraId);

    try {
        const files = fs.readdirSync(recordingsDir)
            .filter(file => file.endsWith('.mp4'))
            .map(file => {
                const filePath = path.join(recordingsDir, file);
                const stats = fs.statSync(filePath);
                return {
                    filename: file,
                    size: stats.size,
                    createdAt: stats.ctime,
                    url: `/api/media/${cameraId}/${file}`
                };
            })
            // Sort by creation date, newest first
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            
        return NextResponse.json(files);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            // If the directory doesn't exist, return an empty array, which is not an error
            return NextResponse.json([]);
        }
        console.error(`[API] Failed to list recordings for camera ${cameraId}:`, error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
} 