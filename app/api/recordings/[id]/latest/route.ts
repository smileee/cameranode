import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { CAMERAS } from '@/cameras.config';
import fsSync from 'fs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const camera = CAMERAS.find(c => c.id === params.id);
  if (!camera) {
    return NextResponse.json({ message: 'Camera not found' }, { status: 404 });
  }

  const recordingsDir = path.join(process.cwd(), 'recordings', params.id);

  try {
    const files = (await fs.readdir(recordingsDir))
      .filter(file => file.endsWith('.mp4'))
      .sort()
      .reverse();

    if (files.length < 2) {
      return NextResponse.json({ message: 'Not enough recordings available to show the latest one.' }, { status: 404 });
    }

    const latestVideoFile = files[1]; // penúltimo para player

    // encontrar a miniatura mais recente que já exista
    let latestThumbFile = files.find(f => {
      const thumbPath = path.join(process.cwd(),'thumbnails',params.id,f.replace('.mp4','.jpg'));
      return fsSync.existsSync(thumbPath);
    }) || latestVideoFile;

    const videoUrl = `/api/recordings/${params.id}/stream/${latestVideoFile}`;
    const thumbUrl = `/api/thumbnails/${params.id}/${latestThumbFile.replace('.mp4', '.jpg')}`;

    return NextResponse.json({ videoUrl, thumbUrl });

  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ message: 'No recordings directory found for this camera.' }, { status: 404 });
    }
    console.error('Failed to get latest recording:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 