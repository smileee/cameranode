import { promises as fs } from 'fs';
import path from 'path';
import { Camera, CAMERAS } from '../cameras.config';

const HLS_OUTPUT_DIR = 'recordings';

interface StreamHealth {
  cameraId: string;
  hasPlaylist: boolean;
  segmentCount: number;
  lastSegmentTime: number | null;
  isHealthy: boolean;
  isMock?: boolean;
  enabled?: boolean;
}

/**
 * Monitors the health of all camera streams
 */
export async function checkStreamHealth(): Promise<StreamHealth[]> {
  const results: StreamHealth[] = [];

  for (const camera of CAMERAS) {
    const cameraId = String(camera.id);
    const liveDir = path.join(process.cwd(), HLS_OUTPUT_DIR, cameraId, 'live');
    
    try {
      // Check if camera is disabled
      if (camera.enabled === false) {
        results.push({
          cameraId,
          hasPlaylist: false,
          segmentCount: 0,
          lastSegmentTime: null,
          isHealthy: false,
          isMock: camera.mock,
          enabled: false
        });
        continue;
      }

      // Check if playlist exists
      const playlistPath = path.join(liveDir, 'live.m3u8');
      let hasPlaylist = false;
      try {
        await fs.access(playlistPath);
        hasPlaylist = true;
      } catch {
        hasPlaylist = false;
      }

      // Count segments and find last modified time
      let segmentCount = 0;
      let lastSegmentTime: number | null = null;
      
      try {
        const files = await fs.readdir(liveDir);
        const segmentFiles = files.filter(file => file.endsWith('.ts'));
        segmentCount = segmentFiles.length;
        
        if (segmentFiles.length > 0) {
          // Get the most recent segment
          const segmentStats = await Promise.all(
            segmentFiles.map(async (file) => {
              const filePath = path.join(liveDir, file);
              const stats = await fs.stat(filePath);
              return { file, mtime: stats.mtime.getTime() };
            })
          );
          
          const mostRecent = segmentStats.reduce((latest, current) => 
            current.mtime > latest.mtime ? current : latest
          );
          lastSegmentTime = mostRecent.mtime;
        }
      } catch (error) {
        console.error(`[Monitor] Error reading segments for camera ${cameraId}:`, error);
      }

      // Determine if stream is healthy
      const now = Date.now();
      let isHealthy = false;
      
      if (camera.mock) {
        // For mock cameras, just check if playlist exists
        isHealthy = hasPlaylist;
      } else {
        // For real cameras, check playlist, segments, and freshness
        isHealthy = hasPlaylist && 
                   segmentCount > 0 && 
                   lastSegmentTime !== null && 
                   (now - lastSegmentTime) < 30000; // Less than 30 seconds old
      }

      results.push({
        cameraId,
        hasPlaylist,
        segmentCount,
        lastSegmentTime,
        isHealthy,
        isMock: camera.mock,
        enabled: camera.enabled
      });

      console.log(`[Monitor ${cameraId}] Health check:`, {
        hasPlaylist,
        segmentCount,
        lastSegmentTime: lastSegmentTime ? new Date(lastSegmentTime).toISOString() : null,
        isHealthy,
        isMock: camera.mock,
        enabled: camera.enabled,
        ageSeconds: lastSegmentTime ? Math.round((now - lastSegmentTime) / 1000) : null
      });

    } catch (error) {
      console.error(`[Monitor] Error checking health for camera ${cameraId}:`, error);
      results.push({
        cameraId,
        hasPlaylist: false,
        segmentCount: 0,
        lastSegmentTime: null,
        isHealthy: false,
        isMock: camera.mock,
        enabled: camera.enabled
      });
    }
  }

  return results;
}

/**
 * Starts periodic monitoring of stream health
 */
export function startStreamMonitoring() {
  console.log('[Monitor] Starting stream health monitoring...');
  
  // Check health every 30 seconds
  setInterval(async () => {
    const health = await checkStreamHealth();
    const unhealthyStreams = health.filter(h => !h.isHealthy && h.enabled !== false);
    
    if (unhealthyStreams.length > 0) {
      console.warn('[Monitor] Unhealthy streams detected:', unhealthyStreams);
    } else {
      console.log('[Monitor] All enabled streams healthy');
    }
  }, 30000);
} 