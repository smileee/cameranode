import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

// This is an alternative to fs.createReadStream that works better with Next.js App Router
function streamFile(path: string): ReadableStream<Uint8Array> {
    const stream = fs.createReadStream(path);
    return new ReadableStream({
        start(controller) {
            stream.on('data', (chunk) => controller.enqueue(Buffer.from(chunk)));
            stream.on('end', () => controller.close());
            stream.on('error', (err) => controller.error(err));
        },
        cancel() {
            stream.destroy();
        }
    });
}

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; file: string[] } }
) {
  const filePath = path.join(process.cwd(), 'recordings', params.id, ...params.file);

  try {
    const stats = await fs.promises.stat(filePath);
    const stream = streamFile(filePath);

    return new Response(stream, {
        status: 200,
        headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': stats.size.toString(),
            'Accept-Ranges': 'bytes',
        }
    });

  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return new Response('File not found', { status: 404 });
    }
    console.error(error);
    return new Response('Internal server error', { status: 500 });
  }
} 