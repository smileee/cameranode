import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import { notFound } from 'next/navigation';
import mime from 'mime-types';

export async function GET(req: NextRequest, { params }: { params: { slug: string[] } }) {
    const filePath = path.join(process.cwd(), ...params.slug);

    try {
        const stats = await fs.stat(filePath);
        const contentType = mime.lookup(filePath) || 'application/octet-stream';
        const totalSize = stats.size;

        const range = req.headers.get('range');

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
            const chunksize = (end - start) + 1;
            
            const file = await fs.open(filePath, 'r');
            const buffer = Buffer.alloc(chunksize);
            await file.read(buffer, 0, chunksize, start);
            await file.close();

            const headers = new Headers();
            headers.set('Content-Range', `bytes ${start}-${end}/${totalSize}`);
            headers.set('Accept-Ranges', 'bytes');
            headers.set('Content-Length', chunksize.toString());
            headers.set('Content-Type', contentType);

            return new Response(buffer, { status: 206, headers });

        } else {
            const fileBuffer = await fs.readFile(filePath);
            const headers = new Headers();
            headers.set('Content-Length', totalSize.toString());
            headers.set('Content-Type', contentType);
            headers.set('Accept-Ranges', 'bytes');
            
            return new Response(fileBuffer, { status: 200, headers });
        }

    } catch (error: any) {
        if (error.code === 'ENOENT') {
            notFound();
        } else {
            console.error(`Error reading media file: ${filePath}`, error);
            return NextResponse.json({ error: 'Error reading file' }, { status: 500 });
        }
    }
} 