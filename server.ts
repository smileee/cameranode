// This file is the custom server entry point.
// It initializes our background services (like camera streamers) before starting the Next.js app.

// Allows ts-node to use path aliases (e.g., @/server/streamer)
// import 'tsconfig-paths/register';

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import next from 'next';
import { initializeCameraStreams } from './server/streamer';
import { CAMERAS } from './cameras.config';
import { addEvent } from './server/db';
import { triggerRecording, getCameraState } from './server/state';
import { finalizeAndSaveRecording } from './server/ffmpeg-utils';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = process.env.PORT || 3000;

/**
 * Handles the webhook request logic directly within the custom server.
 * This ensures that it runs in the same process as the streamer, sharing the same state.
 */
async function handleWebhook(req: IncomingMessage, res: ServerResponse, cameraId: string) {
    const camera = CAMERAS.find(c => c.id === cameraId);
    if (!camera) {
        res.statusCode = 404;
        res.end('Camera not found');
        return;
    }

    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        let eventData = { type: 'motion', label: 'unknown' };
        try {
            const payload = JSON.parse(body);
            eventData = {
                type: payload.type || 'motion',
                label: payload.label || 'no-label',
            };
        } catch (error) {
            console.warn('[Webhook] Could not parse event JSON, using fallback data.');
        }

        addEvent({ cameraId, ...eventData }).catch(err =>
            console.error('[Webhook DB] Failed to save event:', err)
        );

        const eventLabel = eventData.label || eventData.type;
        const session = getCameraState(cameraId).recordingSession;
        const wasAlreadyRecording = session.isRecording;

        triggerRecording(cameraId, eventLabel, (segments, label) => {
            finalizeAndSaveRecording(cameraId, segments, label);
        });

        const message = wasAlreadyRecording
            ? 'Recording already in progress. Trigger ignored.'
            : 'New recording triggered.';

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, message }));
    });
}

app.prepare().then(() => {
    // First, initialize the camera streams.
    console.log('[Server] Initializing background services...');
    initializeCameraStreams();

    // Then, create the HTTP server for the Next.js app.
    createServer((req, res) => {
        if (!req.url) {
            res.statusCode = 400;
            res.end('Bad Request: URL is missing');
            return;
        }

        const parsedUrl = parse(req.url, true);
        const { pathname, query } = parsedUrl;

        // Route webhook requests to our custom handler.
        if (pathname === '/api/webhook' && query.id) {
            handleWebhook(req, res, query.id as string);
        } else {
            handle(req, res, parsedUrl);
        }
    }).listen(port, () => {
        console.log(`[Server] Ready on http://localhost:${port}`);
    });
}); 