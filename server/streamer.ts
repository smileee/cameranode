import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn, ChildProcess } from 'child_process';
import { CAMERAS } from '../cameras.config';
import ffmpegPath from 'ffmpeg-static';

const STREAM_PORT = 8082;
const FFMPEG_PATH = (ffmpegPath as string) || 'ffmpeg';

// Keep track of running ffmpeg processes, one per camera ID
const runningStreams: Record<string, ChildProcess> = {};

const server = createServer();
const wss = new WebSocketServer({ server });

console.log(`[STREAMER] WebSocket streaming server starting on port ${STREAM_PORT}`);

wss.on('connection', (ws: WebSocket, req) => {
  const url = req.url || '/';
  const cameraId = url.substring(1); // Expecting URL format like "/<camera_id>"
  const camera = CAMERAS.find(c => c.id === cameraId);

  if (!camera) {
    console.log(`[STREAMER] Client connected for unknown camera ID: ${cameraId}. Closing connection.`);
    ws.close(1011, `Camera with ID ${cameraId} not found.`);
    return;
  }

  console.log(`[STREAMER] Client connected for camera: ${camera.name} (ID: ${cameraId})`);

  // Tag this WebSocket with the camera ID so we can broadcast correctly
  (ws as any).cameraId = cameraId;

  // Send JSMpeg stream header so the client can decode dimensions
  const width = 1280;
  const height = 720;
  const header = new Uint8Array(8);
  header[0] = 0x4a; // J
  header[1] = 0x53; // S
  header[2] = 0x4d; // M
  header[3] = 0x50; // P
  header[4] = (width >> 8) & 0xff;
  header[5] = width & 0xff;
  header[6] = (height >> 8) & 0xff;
  header[7] = height & 0xff;
  ws.send(header);

  // If a stream for this camera is already running, just add the new client
  if (runningStreams[cameraId] && !runningStreams[cameraId].killed) {
    console.log(`[STREAMER] FFMPEG for ${camera.name} is already running.`);
    ws.on('close', () => handleClientDisconnect(cameraId));
    return;
  }
  
  // Start a new FFMPEG process for this camera
  const ffmpegArgs = [
    '-probesize', '5M', // Increase buffer to handle unstable streams
    '-rtsp_transport', 'tcp',
    '-i', camera.rtspUrl,
    '-f', 'mpegts',
    '-codec:v', 'mpeg1video',
    '-s', '1280x720', // Stream resolution
    '-b:v', '1000k',  // Bitrate
    '-r', '30',       // Set output frame rate to 30 fps
    '-bf', '0',       // No B-frames
    '-an',            // No audio
    'pipe:1',
  ];
  
  console.log(`[FFMPEG] Spawning for ${camera.name}: ${FFMPEG_PATH} ${ffmpegArgs.join(' ')}`);
  const ffmpegProcess = spawn(FFMPEG_PATH, ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
  runningStreams[cameraId] = ffmpegProcess;

  ffmpegProcess.stdout.on('data', (data) => {
    // Broadcast the video data to all clients watching this stream
    wss.clients.forEach(client => {
      if ((client as any).cameraId === cameraId && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  });

  ffmpegProcess.stderr.on('data', (data) => {
    console.error(`[FFMPEG_STDERR][${camera.name}] ${data.toString()}`);
  });

  ffmpegProcess.on('error', (err) => {
    console.error(`[FFMPEG_ERROR][${camera.name}]`, err);
    stopStream(cameraId);
  });

  ffmpegProcess.on('close', (code) => {
    console.log(`[FFMPEG][${camera.name}] process exited with code ${code}`);
    delete runningStreams[cameraId];
  });

  ws.on('close', () => handleClientDisconnect(cameraId));
});

function handleClientDisconnect(cameraId: string) {
  const camera = CAMERAS.find(c => c.id === cameraId);
  const name = camera ? camera.name : `ID ${cameraId}`;
  console.log(`[STREAMER] Client disconnected from ${name}.`);

  // Check if any clients are still watching this stream
  let clientsForThisStream = 0;
  wss.clients.forEach(client => {
    if (client.url === `/${cameraId}` && client.readyState === WebSocket.OPEN) {
      clientsForThisStream++;
    }
  });

  console.log(`[STREAMER] Remaining clients for ${name}: ${clientsForThisStream}`);
  
  if (clientsForThisStream === 0) {
    stopStream(cameraId);
  }
}

function stopStream(cameraId: string) {
  const process = runningStreams[cameraId];
  if (process && !process.killed) {
    const camera = CAMERAS.find(c => c.id === cameraId);
    const name = camera ? camera.name : `ID ${cameraId}`;
    console.log(`[FFMPEG] No clients left for ${name}. Stopping stream.`);
    process.kill('SIGTERM');
    delete runningStreams[cameraId];
  }
}

server.listen(STREAM_PORT, () => {
  console.log(`[STREAMER] Server is listening on http://localhost:${STREAM_PORT}`);
});
