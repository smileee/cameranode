import { ChildProcess } from 'child_process';

// Represents a video segment for HLS streaming.
export interface HlsSegment {
  filename: string; // e.g., 'segment0001.ts'
  startTime: number; // Unix timestamp (ms) when the segment started
}

/**
 * Represents an active recording session triggered by a webhook.
 */
type RecordingSession = {
  isRecording: boolean;
  // A list of all segment filenames (e.g., 'segment000123.ts') to be included in the final video.
  segmentsToRecord: string[];
  // The timer that will trigger the finalization of the recording.
  finalizeTimeoutId: NodeJS.Timeout | null;
  // The event label that triggered the recording.
  label: string;
};


// Defines the state for a single camera.
type CameraState = {
  // The persistent ffmpeg process that generates the HLS stream.
  hlsStreamerProcess: ChildProcess | null;
  // The queue of recent HLS segments, used as a pre-roll buffer.
  hlsSegmentBuffer: HlsSegment[];
  // State of the webhook-triggered recording, if active.
  recordingSession: RecordingSession;
};

const cameraStates = new Map<string, CameraState>();

/**
 * Retrieves the current state for a given camera, initializing it if it doesn't exist.
 * @param cameraId - The unique identifier for the camera.
 * @returns The state object for the camera.
 */
export function getCameraState(cameraId: string): CameraState {
  if (!cameraStates.has(cameraId)) {
    cameraStates.set(cameraId, {
      hlsStreamerProcess: null,
      hlsSegmentBuffer: [],
      recordingSession: {
        isRecording: false,
        segmentsToRecord: [],
        finalizeTimeoutId: null,
        label: 'default',
      },
    });
  }
  return cameraStates.get(cameraId)!;
}

/**
 * Associates the persistent HLS streamer process with a camera.
 * @param cameraId - The camera's ID.
 * @param process - The spawned ffmpeg child process.
 */
export function setHlsStreamerProcess(cameraId: string, process: ChildProcess) {
  const state = getCameraState(cameraId);
  state.hlsStreamerProcess = process;
}

/**
 * Adds a new HLS segment to the camera's buffer and manages the buffer size.
 * @param cameraId - The camera's ID.
 * @param segment - The HLS segment information to add.
 * @param bufferSize - The maximum number of segments to keep in the buffer.
 */
export function addHlsSegment(cameraId: string, segment: HlsSegment, bufferSize: number = 30) {
    const state = getCameraState(cameraId);
    state.hlsSegmentBuffer.push(segment);

    // If a recording is active, add this new segment to the list.
    if (state.recordingSession.isRecording) {
        state.recordingSession.segmentsToRecord.push(segment.filename);
    }

    // Keep the buffer from growing indefinitely.
    while (state.hlsSegmentBuffer.length > bufferSize) {
        state.hlsSegmentBuffer.shift();
    }
}

const RECORDING_DURATION_MS = 75 * 1000; // 15s of pre-roll + 60s of recording.

/**
 * Triggers a new, fixed-length recording session if one is not already active.
 * This function is designed to be simple and robust, creating one video per event trigger.
 * @param cameraId - The camera's ID.
 * @param label - The label for the event (e.g., 'person_detected').
 * @param finalizeCallback - The function to call when the recording is ready to be finalized.
 */
export function triggerRecording(
    cameraId: string, 
    label: string,
    finalizeCallback: () => void,
) {
    const state = getCameraState(cameraId);
    const session = state.recordingSession;

    // If a recording is already in progress, ignore the new trigger to prevent overlapping videos.
    if (session.isRecording) {
        console.log(`[State ${cameraId}] Trigger received for '${label}', but a recording is already in progress. Ignoring.`);
        return;
    }

    // Start a new recording session.
    console.log(`[State ${cameraId}] Starting new recording session for event: ${label}`);
    session.isRecording = true;
    session.label = label;
    
    // Immediately capture the current pre-roll buffer.
    session.segmentsToRecord = state.hlsSegmentBuffer.map(s => s.filename);
    console.log(`[State ${cameraId}] Captured ${session.segmentsToRecord.length} pre-roll segments.`);

    // Set a non-extendable timer to finalize the recording after a fixed duration.
    session.finalizeTimeoutId = setTimeout(() => {
        console.log(`[State ${cameraId}] Finalizing recording for event: ${session.label}`);
        finalizeCallback();
        
        // Reset the session state after triggering the finalization.
        session.isRecording = false;
        session.segmentsToRecord = [];
        session.finalizeTimeoutId = null;
        session.label = 'default';
    }, RECORDING_DURATION_MS);

    console.log(`[State ${cameraId}] Recording will be finalized in ${RECORDING_DURATION_MS / 1000} seconds.`);
}

/**
 * Kills all running ffmpeg processes for all cameras. Used for graceful shutdown.
 */
export function cleanupAllProcesses() {
  console.log('[State] Cleaning up all camera processes...');
  cameraStates.forEach((state, cameraId) => {
    if (state.hlsStreamerProcess) {
      console.log(`[State] Killing HLS streamer for camera ${cameraId}`);
      state.hlsStreamerProcess.kill('SIGINT');
      state.hlsStreamerProcess = null;
    }
  });
}
