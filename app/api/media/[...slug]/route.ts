import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { stat } from 'fs/promises';

/**
 * API route to serve static media files (recordings).
 * The path is captured in the 'slug' parameter.
 */
export async function GET(request: Request, { params }: { params: { slug: string[] } }) {
    // The slug is an array of path segments. e.g., ['file', 'recordings', '1', 'rec-....mp4']
    const slug = params.slug;

    if (!slug || slug.length < 2 || slug[0] !== 'file') {
        return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    // Reconstruct the file path relative to the project root.
    // We skip the first 'file' segment.
    const relativePath = path.join(...slug.slice(1));
    const filePath = path.join(process.cwd(), relativePath);

    try {
        // Check if the file exists and get its stats.
        const stats = await stat(filePath);
        const stream = fs.createReadStream(filePath);
        
        // Return the video file as a stream.
        return new NextResponse(stream as any, {
            status: 200,
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Length': stats.size.toString(),
            },
        });
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }
        console.error(`[API Media File] Error serving file ${filePath}:`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
} 