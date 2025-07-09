import { ChildProcess } from 'child_process';

// Represents a video segment for HLS streaming.
export interface HlsSegment {
  filename: string; // e.g., 'segment0001.ts'
  startTime: number; // Unix timestamp (ms) when the segment started
}

/**
 * Represents an active recording session triggered by a webhook.
 */
// This is no longer needed, as we are moving to on-demand recording.
// type RecordingSession = {
//   isRecording: boolean;
//   segmentsToRecord: string[];
//   finalizeTimeoutId: NodeJS.Timeout | null;
//   label: string;
// };


// Defines the state for a single camera.
type CameraState = {
  // The persistent ffmpeg process that generates the HLS stream.
  hlsStreamerProcess: ChildProcess | null;
  // A buffer of recent HLS segments. This is used to construct recordings on-demand.
  hlsSegmentBuffer: HlsSegment[];
  // The recording session state has been removed.
  // recordingSession: RecordingSession;
};

// Ensure a single shared state across the entire Node.js process, even if the module
// is duplicated by different bundling/require paths (which Next.js can do for app routes).
// We attach it to the global object so every import gets the same reference.

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const globalAny = globalThis as any;

if (!globalAny.__CAMERANODE_CAMERA_STATES) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  globalAny.__CAMERANODE_CAMERA_STATES = new Map<string, CameraState>();
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const cameraStates: Map<string, CameraState> = globalAny.__CAMERANODE_CAMERA_STATES;

/**
 * Retrieves the current state for a given camera, initializing it if it doesn't exist.
 * @param cameraId - The unique identifier for the camera.
 * @returns The state object for the camera.
 */
export function getCameraState(cameraId: string): CameraState {
  // Normalize the key to a string to avoid separate states for numeric vs string IDs.
  const key = String(cameraId);

  if (!cameraStates.has(key)) {
    cameraStates.set(key, {
      hlsStreamerProcess: null,
      hlsSegmentBuffer: [],
      // recordingSession: {
      //   isRecording: false,
      //   segmentsToRecord: [],
      //   finalizeTimeoutId: null,
      //   label: 'default',
      // },
    });
  }
  return cameraStates.get(key)!;
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
export function addHlsSegment(cameraId: string, segment: HlsSegment, bufferSize: number = 150) { // Keep ~5 mins of footage (150 segs * 2s)
    const state = getCameraState(cameraId);
    state.hlsSegmentBuffer.push(segment);

    // Keep the buffer from growing indefinitely.
    while (state.hlsSegmentBuffer.length > bufferSize) {
        state.hlsSegmentBuffer.shift();
    }

    console.log(`[State ${cameraId}] Added segment ${segment.filename}. Buffer size: ${state.hlsSegmentBuffer.length}.`);
}


// The triggerRecording function has been removed. Webhooks now only log an event.
// The frontend will be responsible for initiating the creation of a video file from the segments.

/**
 * Kills all running ffmpeg processes for all cameras, attempting a graceful shutdown first.
 */
export function cleanupAllProcesses() {
  console.log('[State] Cleaning up all camera processes...');
  cameraStates.forEach((state, cameraId) => {
    const process = state.hlsStreamerProcess;
    if (process && !process.killed) {
      console.log(`[State] Initiating graceful shutdown for camera ${cameraId} (PID: ${process.pid})...`);
      
      // Remove all listeners to prevent automatic restart or other side effects during shutdown.
      process.removeAllListeners();

      // Attempt a graceful shutdown first.
      process.kill('SIGTERM');

      // Set a timeout to forcefully kill the process if it doesn't exit gracefully.
      const killTimeout = setTimeout(() => {
        if (!process.killed) {
          console.warn(`[State] FFMPEG process for camera ${cameraId} did not exit gracefully. Forcing shutdown with SIGKILL.`);
          process.kill('SIGKILL');
        }
      }, 2000); // 2-second grace period.

      process.on('exit', () => {
        console.log(`[State] FFMPEG process for camera ${cameraId} exited gracefully.`);
        clearTimeout(killTimeout); // The process exited, so we don't need the forceful kill.
      });

      state.hlsStreamerProcess = null;
    }
  });
}
