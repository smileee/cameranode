// This file is the custom server entry point.
// It initializes our background services (like camera streamers) before starting the Next.js app.

// Allows ts-node to use path aliases (e.g., @/server/streamer)
// import 'tsconfig-paths/register';

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { initializeCameraStreams } from './server/streamer';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    // First, initialize the camera streams.
    console.log('[Server] Initializing background services...');
    initializeCameraStreams();

    // Then, create the HTTP server for the Next.js app.
    createServer((req, res) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
    }).listen(3000, () => {
        console.log('[Server] Ready on http://localhost:3000');
    });
}); 