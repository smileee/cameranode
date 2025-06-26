import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import { WebSocketServer, WebSocket } from 'ws';
import { CAMERAS, Camera } from '../cameras.config';

const MAX_TOTAL_SIZE = 2 * 1024 * 1024 * 1024; // 2GB per camera
const STATUS_WS_PORT = 8081;

// --- Status Management & WebSocket Server ---

type CameraStatus = 'recording' | 'error' | 'restarting';

const cameraStatuses: Record<string, { status: CameraStatus, lastUpdate: number }> = {};
let wss: WebSocketServer;

function setupWebSocketServer() {
  wss = new WebSocketServer({ port: STATUS_WS_PORT });
  console.log(`[WSS] Status WebSocket server started on port ${STATUS_WS_PORT}`);
  
  wss.on('connection', (ws) => {
    console.log('[WSS] Client connected.');
    // Send initial statuses
    ws.send(JSON.stringify(cameraStatuses));
  });

  wss.on('close', () => {
    console.log('[WSS] WebSocket server closed.');
  });
}

function broadcastStatuses() {
  if (!wss) return;
  const payload = JSON.stringify(cameraStatuses);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function updateCameraStatus(id: string, status: CameraStatus) {
  console.log(`[STATUS] Updating ${id} to ${status}`);
  cameraStatuses[id] = { status, lastUpdate: Date.now() };
  broadcastStatuses();
}

// --- File & Thumbnail Management ---

function getCameraDirs(camera: Camera) {
  const CWD = process.cwd();
  return {
    RECORDING_DIR: path.join(CWD, 'recordings', camera.id),
    THUMB_DIR: path.join(CWD, 'thumbnails', camera.id),
  };
}

function createThumbnail(videoPath: string, thumbPath: string) {
  if (fs.existsSync(thumbPath)) return;

  console.log(`[THUMB] Creating thumbnail for ${path.basename(videoPath)}...`);
  const thumbProcess = spawn('ffmpeg', [
    '-i', videoPath,
    '-ss', '00:00:01.000',
    '-vframes', '1',
    '-y',
    thumbPath
  ]);

  thumbProcess.on('close', (code) => {
    if (code === 0) {
      console.log(`[THUMB] Successfully created thumbnail: ${path.basename(thumbPath)}`);
    } else {
      console.error(`[THUMB] ffmpeg exited with code ${code} for ${path.basename(thumbPath)}`);
    }
  });

  thumbProcess.stderr.on('data', (data) => {
    console.error(`[THUMBNAIL-STDERR] for ${path.basename(videoPath)}: ${data}`);
  });
}

function manageRecordings(camera: Camera) {
  const { RECORDING_DIR, THUMB_DIR } = getCameraDirs(camera);
  console.log(`[CLEANUP] Checking folder size for ${camera.name}...`);
  const files = fs.readdirSync(RECORDING_DIR)
    .filter((f) => f.endsWith('.mp4'))
    .map((f) => {
      const p = path.join(RECORDING_DIR, f);
      try {
        const s = fs.statSync(p);
        return { p, size: s.size, mtime: s.mtimeMs };
      } catch { return null; }
    })
    .filter((f): f is NonNullable<typeof f> => f !== null)
    .sort((a, b) => a.mtime - b.mtime);

  let total = files.reduce((acc, f) => acc + f.size, 0);
  console.log(`[CLEANUP] Found ${files.length} recordings for ${camera.name}, total size: ${(total / (1024 * 1024)).toFixed(2)} MB`);

  while (total > MAX_TOTAL_SIZE && files.length) {
    const oldest = files.shift();
    if (!oldest) break;
    try {
      console.log(`[CLEANUP] Deleting oldest file: ${path.basename(oldest.p)}`);
      fs.unlinkSync(oldest.p);
      const thumbPath = path.join(THUMB_DIR, path.basename(oldest.p, '.mp4') + '.jpg');
      if (fs.existsSync(thumbPath)) {
        fs.unlinkSync(thumbPath);
        console.log(`[CLEANUP] Deleted corresponding thumbnail: ${path.basename(thumbPath)}`);
      }
      total -= oldest.size;
    } catch (err) {
      console.error(`[CLEANUP] Failed to delete ${oldest.p}`, err);
      break;
    }
  }
}

function startRecordingForCamera(camera: Camera) {
  const { RECORDING_DIR, THUMB_DIR } = getCameraDirs(camera);
  [RECORDING_DIR, THUMB_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  updateCameraStatus(camera.id, 'restarting');

  const recArgs = [
    '-rtsp_transport', 'tcp', '-i', camera.rtspUrl, '-c', 'copy',
    '-map', '0', '-f', 'segment', '-segment_time', '30',
    '-reset_timestamps', '1', '-strftime', '1',
    path.join(RECORDING_DIR, 'rec-%Y%m%d-%H%M%S.mp4')
  ];

  let recorderProcess: ChildProcess | null = null;
  let watchdogTimer: NodeJS.Timeout | null = null;

  function spawnRecorder() {
    console.log(`[REC] Spawning FFMPEG for ${camera.name} with args: ${recArgs.join(' ')}`);
    const rec = spawn('ffmpeg', recArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    recorderProcess = rec;
    updateCameraStatus(camera.id, 'restarting');

    if (rec.stdout) {
      rec.stdout.on('data', (data) => console.log(`[REC STDOUT - ${camera.name}]: ${data.toString()}`));
    }
    if (rec.stderr) {
      rec.stderr.on('data', (data) => console.error(`[REC STDERR - ${camera.name}]: ${data.toString()}`));
    }
    
    rec.on('close', (code) => {
      console.error(`[REC] Recorder for ${camera.name} exited with code ${code}, restarting in 5s...`);
      updateCameraStatus(camera.id, 'restarting');
      recorderProcess = null;
      if (watchdogTimer) clearInterval(watchdogTimer);
      setTimeout(spawnRecorder, 5000);
    });

    // Setup watchdog to detect stalled ffmpeg process
    if (watchdogTimer) clearInterval(watchdogTimer);
    watchdogTimer = setInterval(() => {
        const camStatus = cameraStatuses[camera.id];
        if (!camStatus) return;

        const timeSinceLastUpdate = Date.now() - camStatus.lastUpdate;

        // If it has been trying to restart for too long, or was recording but has stalled
        if (timeSinceLastUpdate > 150000) { // 2.5 minutes
            console.error(`[WATCHDOG] Camera ${camera.name} appears stalled (status: ${camStatus.status}, last update: ${timeSinceLastUpdate/1000}s ago). Restarting...`);
            if (recorderProcess) {
                recorderProcess.kill('SIGKILL'); // Force kill
            }
        }
    }, 30000); // Check every 30 seconds

    return rec;
  }
  
  spawnRecorder();

  const watcher = chokidar.watch(RECORDING_DIR, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 2000 } });

  console.log(`[WATCHER] Chokidar is now watching ${RECORDING_DIR} for ${camera.name}.`);

  watcher.on('add', (file) => {
    if(!file.endsWith('.mp4')) return;
    console.log(`[WATCHER] ${new Date().toLocaleTimeString()} – New recording for ${camera.name}: ${path.basename(file)}`);
    // A new file means the stream is active. Update status.
    updateCameraStatus(camera.id, 'recording');
    manageRecordings(camera);
    // Add a delay before creating the thumbnail to ensure the file is ready
    setTimeout(() => {
        createThumbnail(file, path.join(THUMB_DIR, path.basename(file, '.mp4') + '.jpg'));
    }, 2000);
  });

  // Initial cleanup check
  manageRecordings(camera);
}

function main() {
  setupWebSocketServer();
  if (CAMERAS.length === 0) {
    console.log("No cameras defined in cameras.config.ts. Exiting recorder service.");
    return;
  }
  console.log(`Starting recording service for ${CAMERAS.length} camera(s).`);
  CAMERAS.forEach(startRecordingForCamera);
}

main(); 