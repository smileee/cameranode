import { ChildProcess } from 'child_process';

// Represents a video segment for HLS streaming.
export interface HlsSegment {
  filename: string; // e.g., 'segment0001.ts'
  startTime: number; // Unix timestamp (ms) when the segment started
}

type WebhookRecordingState = {
  // Timer to automatically stop the recording after a certain duration.
  stopTimer: NodeJS.Timeout;
  // Unix timestamp (ms) when the recording was triggered.
  startedAt: number;
  // Path to the temporary .m3u8 playlist for this specific recording.
  playlistPath: string;
};

// Defines the state for a single camera.
type CameraState = {
  // The persistent ffmpeg process that generates the HLS stream.
  hlsStreamerProcess: ChildProcess | null;
  // The queue of recent HLS segments, used as a pre-roll buffer.
  hlsSegmentBuffer: HlsSegment[];
  // State of the webhook-triggered recording, if active.
  webhookRecording: WebhookRecordingState | null;
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
      webhookRecording: null,
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

    // Keep the buffer from growing indefinitely.
    while (state.hlsSegmentBuffer.length > bufferSize) {
        state.hlsSegmentBuffer.shift();
    }
}

/**
 * Starts or extends a webhook-triggered recording for a camera.
 * @param cameraId - The camera's ID.
 * @param recordingData - The state and timer for the recording.
 */
export function setWebhookRecording(cameraId: string, recordingData: WebhookRecordingState) {
  const state = getCameraState(cameraId);
  // If there's an existing timer, clear it to extend the recording.
  if (state.webhookRecording?.stopTimer) {
    clearTimeout(state.webhookRecording.stopTimer);
  }
  state.webhookRecording = recordingData;
}

/**
 * Clears the webhook recording state for a camera, typically after it finishes.
 * @param cameraId - The camera's ID.
 */
export function clearWebhookRecording(cameraId: string) {
  const state = getCameraState(cameraId);
  if (state.webhookRecording?.stopTimer) {
    clearTimeout(state.webhookRecording.stopTimer);
  }
  state.webhookRecording = null;
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