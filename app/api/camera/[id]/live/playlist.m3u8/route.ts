import type { NextRequest } from 'next/server';
import { GET as liveHandler } from '../route';

// Proxy the request to the parent live route so that `/live/playlist.m3u8` works.
export async function GET(request: NextRequest, context: { params: { id: string } }) {
  return liveHandler(request, context as any);
} 