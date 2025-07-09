import { NextResponse } from 'next/server';
import { CAMERAS } from '@/cameras.config';
import net from 'net';

const checkCameraStatus = (rtspUrl: string): Promise<'online' | 'offline'> => {
  return new Promise((resolve) => {
    try {
      const url = new URL(rtspUrl);
      const port = parseInt(url.port, 10) || 554;
      const host = url.hostname;

      if (!host) {
        resolve('offline');
        return;
      }

      const socket = new net.Socket();
      const timeout = 2000; // 2 seconds

      socket.setTimeout(timeout);

      socket.on('connect', () => {
        socket.destroy();
        resolve('online');
      });

      socket.on('error', () => {
        socket.destroy();
        resolve('offline');
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve('offline');
      });

      socket.connect(port, host);
    } catch (error) {
      console.error('[Status Check] Error parsing RTSP URL:', error);
      resolve('offline');
    }
  });
};

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const camera = CAMERAS.find((c) => c.id === params.id);

  if (!camera) {
    return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
  }

  const status = await checkCameraStatus(camera.rtspUrl);

  // Add cache-control headers to prevent caching of the status
  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
  };

  return NextResponse.json({ status }, { headers });
} 