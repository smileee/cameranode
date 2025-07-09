import { NextResponse } from 'next/server';
import { cleanupAllProcesses } from '@/server/state';

export async function POST() {
  try {
    console.log('[API /disconnect] Received request to disconnect all cameras.');
    cleanupAllProcesses();
    return NextResponse.json({ message: 'All camera processes are being gracefully shut down.' }, { status: 200 });
  } catch (error) {
    console.error('[API /disconnect] Error during cleanup:', error);
    return NextResponse.json({ message: 'An error occurred while trying to disconnect cameras.' }, { status: 500 });
  }
} 