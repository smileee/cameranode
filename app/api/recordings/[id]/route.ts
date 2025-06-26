import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { CAMERAS } from '@/cameras.config';

type RecordingFile = {
  name: string;
  mtime: number;
  size: number;
};

function getRecordingsForCamera(cameraId: string, page: number, size: number) {
    const camera = CAMERAS.find(c => c.id === cameraId);
    if (!camera) throw new Error('Camera not found');

    const RECORDING_DIR = path.join(process.cwd(), 'recordings', camera.id);
    if (!fs.existsSync(RECORDING_DIR)) {
        return { total: 0, page, size, items: [] };
    }

    const files: RecordingFile[] = fs.readdirSync(RECORDING_DIR)
        .filter(f => f.endsWith('.mp4'))
        .map(f => {
            try {
                const p = path.join(RECORDING_DIR, f);
                const st = fs.statSync(p);
                return { name: f, mtime: st.mtimeMs, size: st.size };
            } catch { return null; }
        })
        .filter((f): f is RecordingFile => f !== null && f.size > 10000)
        .sort((a, b) => b.mtime - a.mtime);

    const total = files.length;
    const start = (page - 1) * size;
    const paginatedFiles = files.slice(start, start + size);

    const items = paginatedFiles.map(f => ({
        video: `/api/recordings/${camera.id}/stream/${f.name}`,
        thumb: fs.existsSync(path.join(process.cwd(),'thumbnails',camera.id,f.name.replace(/\.mp4$/,'.jpg'))) ? `/api/thumbnails/${camera.id}/${f.name.replace(/\.mp4$/, '.jpg')}` : '',
        date: new Date(f.mtime).toISOString()
    }));

    return { total, page, size, items };
}


export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const size = parseInt(searchParams.get('size') || '10', 10);

  try {
    const recordings = getRecordingsForCamera(params.id, page, size);
    return NextResponse.json(recordings);
  } catch (error) {
    console.error(`[API] Error fetching recordings for ${params.id}:`, error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
} 