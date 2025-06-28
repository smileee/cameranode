import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { notFound } from 'next/navigation';
import mime from 'mime-types';

export async function GET(req: NextRequest, { params }: { params: { slug: string[] } }) {
    const [cameraId, mediaType, filename] = params.slug;

    if (!cameraId || !mediaType || !filename) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    if (mediaType !== 'screenshots' && mediaType !== 'recordings') {
        return NextResponse.json({ error: 'Invalid media type' }, { status: 400 });
    }

    // Basic security check
    if (filename.includes('..')) {
         return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }
    
    const filePath = path.join(process.cwd(), mediaType, cameraId, filename);

    try {
        const fileBuffer = await fs.readFile(filePath);
        const mimeType = mime.lookup(filePath) || 'application/octet-stream';
        
        return new NextResponse(fileBuffer, {
            status: 200,
            headers: { 'Content-Type': mimeType },
        });

    } catch (error: any) {
        if (error.code === 'ENOENT') {
            notFound();
        } else {
            console.error(`Error reading media file: ${filePath}`, error);
            return NextResponse.json({ error: 'Error reading file' }, { status: 500 });
        }
    }
} 