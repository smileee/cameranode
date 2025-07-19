import { NextRequest, NextResponse } from 'next/server';
import { getEventById, updateEvent } from '@/server/db';
import { getCameraState } from '@/server/state';
import { createRecordingFromSegments } from '@/server/ffmpeg-utils';

/**
 * Handles the finalization of a recording for a given event.
 * This should be called after an event is created. It finds the relevant
 * video segments from the live buffer, concatenates them into an MP4,
 * generates a thumbnail, and updates the event in the database with the paths.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const eventId = params.id;

  if (!eventId) {
    return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
  }

  console.log(`[API/Finalize] Received request to finalize event: ${eventId}`);

  // This is a fire-and-forget API route, so we don't block.
  // We start the processing but return a response immediately.
  (async () => {
    try {
      const event = await getEventById(eventId);
      if (!event) {
        console.error(`[API/Finalize] Event not found: ${eventId}`);
        return;
      }
      
      const cameraState = getCameraState(event.cameraId);
      const segmentsToSave = cameraState.hlsSegmentBuffer.map(s => s.filename);

      if (segmentsToSave.length === 0) {
        console.warn(`[API/Finalize] No segments in buffer for camera ${event.cameraId}. Cannot create recording.`);
        return;
      }

      const recordingPaths = await createRecordingFromSegments(
        eventId,
        event.cameraId,
        segmentsToSave
      );

      if (recordingPaths) {
        await updateEvent(eventId, {
          recordingPath: recordingPaths.videoPath,
          thumbnailPath: recordingPaths.thumbnailPath,
          status: 'completed',
        });
        console.log(`[API/Finalize] Successfully finalized and updated event ${eventId}.`);
      } else {
        console.error(`[API/Finalize] Failed to create recording for event ${eventId}.`);
        await updateEvent(eventId, { status: 'failed' });
      }
    } catch (error) {
      console.error(`[API/Finalize] Unhandled error during finalization for event ${eventId}:`, error);
      // Attempt to mark the event as failed even if an unexpected error occurs.
      try {
        await updateEvent(eventId, { status: 'failed' });
      } catch (dbError) {
        console.error(`[API/Finalize] Could not even mark event ${eventId} as failed.`, dbError);
      }
    }
  })();


  return NextResponse.json({
    message: `Finalization process started for event ${eventId}.`,
  });
}
