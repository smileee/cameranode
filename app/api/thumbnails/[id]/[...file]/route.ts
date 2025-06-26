import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; file: string[] } }
) {
  const filePath = path.join(process.cwd(), 'thumbnails', params.id, ...params.file);

  try {
    const fileBuffer = await fs.promises.readFile(filePath);
    
    return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
            'Content-Type': 'image/jpeg',
        }
    });

  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // Return a 1x1 pixel transparent GIF as a fallback
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      return new NextResponse(pixel, {
        status: 404,
        headers: { 'Content-Type': 'image/gif' }
      });
    }
    console.error(error);
    return new NextResponse('Internal server error', { status: 500 });
  }
} 