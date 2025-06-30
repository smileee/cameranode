import { ChildProcess } from 'child_process';

type CameraState = {
  isManualRecording: boolean;
  isWebhookRecording: boolean;
  streamerProcess: ChildProcess | null;
  manualRecordingProcess: ChildProcess | null;
  webhookRecordingProcess: ChildProcess | null;
  webhookRecordingTimer: NodeJS.Timeout | null;
};

const cameraStates = new Map<string, CameraState>();

function getInitialState(): CameraState {
  return {
    isManualRecording: false,
    isWebhookRecording: false,
    streamerProcess: null,
    manualRecordingProcess: null,
    webhookRecordingProcess: null,
    webhookRecordingTimer: null,
  };
}

export function getCameraState(cameraId: string): CameraState {
  if (!cameraStates.has(cameraId)) {
    cameraStates.set(cameraId, getInitialState());
  }
  return cameraStates.get(cameraId)!;
}

export function setCameraManualRecordingProcess(cameraId: string, process: ChildProcess) {
  const state = getCameraState(cameraId);
  state.isManualRecording = true;
  state.manualRecordingProcess = process;
}

export function clearCameraManualRecordingProcess(cameraId: string) {
  const state = getCameraState(cameraId);
  if (state.manualRecordingProcess) {
    console.log(`Killing manual recording process for camera ${cameraId}`);
    state.manualRecordingProcess.kill('SIGINT');
    state.isManualRecording = false;
    state.manualRecordingProcess = null;
  }
}

export function setCameraWebhookRecordingProcess(cameraId: string, process: ChildProcess, timer: NodeJS.Timeout) {
  const state = getCameraState(cameraId);

  if (state.webhookRecordingTimer) {
      clearTimeout(state.webhookRecordingTimer);
  }

  state.isWebhookRecording = true;
  state.webhookRecordingProcess = process;
  state.webhookRecordingTimer = timer;
}

export function clearCameraWebhookRecordingProcess(cameraId: string) {
  const state = getCameraState(cameraId);
  if (state.webhookRecordingProcess) {
    console.log(`[State] Webhook recording process for camera ${cameraId} finished or cleared.`);
    state.isWebhookRecording = false;
    state.webhookRecordingProcess = null;
  }
   if (state.webhookRecordingTimer) {
    clearTimeout(state.webhookRecordingTimer);
    state.webhookRecordingTimer = null;
  }
}

export function stopCameraWebhookRecordingProcess(cameraId: string) {
    const state = getCameraState(cameraId);
    if (state.webhookRecordingProcess && state.webhookRecordingProcess.stdin) {
        console.log(`[State] Gracefully stopping webhook recording for camera ${cameraId} by sending 'q'`);
        // We write 'q' to stdin to tell ffmpeg to close the output file gracefully.
        state.webhookRecordingProcess.stdin.write('q');
    } else {
        console.log(`[State] No webhook recording process to stop for camera ${cameraId}. Clearing state.`);
        // If the process or stdin is not available, we just clear the state.
        clearCameraWebhookRecordingProcess(cameraId);
  }
}

// Keep streamer state separate
export function setCameraStreamerProcess(cameraId: string, process: ChildProcess) {
    const state = getCameraState(cameraId);
    state.streamerProcess = process;
}

export function clearCameraStreamerProcess(cameraId: string) {
    const state = getCameraState(cameraId);
    if (state.streamerProcess) {
        state.streamerProcess.kill();
        state.streamerProcess = null;
    }
} 