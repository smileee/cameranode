'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconArrowLeft, IconRefresh } from '@tabler/icons-react';

interface StreamHealth {
  cameraId: string;
  hasPlaylist: boolean;
  segmentCount: number;
  lastSegmentTime: number | null;
  isHealthy: boolean;
}

interface HealthResponse {
  timestamp: string;
  overall: {
    healthy: boolean;
    totalCameras: number;
    unhealthyCount: number;
  };
  streams: StreamHealth[];
}

export default function DebugPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/health');
      if (response.ok) {
        const data = await response.json();
        setHealth(data);
      } else {
        setError('Failed to fetch health data');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = Date.now();
    const diffSeconds = Math.round((now - timestamp) / 1000);
    return `${date.toLocaleTimeString()} (${diffSeconds}s ago)`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-2">
              <IconArrowLeft size={16} className="mr-2" />
              Back to Cameras
            </Link>
            <h1 className="text-2xl font-bold">Stream Health Monitor</h1>
          </div>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <IconRefresh size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </header>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {health && (
          <div className="space-y-6">
            {/* Overall Status */}
            <div className={`p-4 rounded-lg border ${
              health.overall.healthy 
                ? 'bg-green-100 border-green-400 text-green-800' 
                : 'bg-red-100 border-red-400 text-red-800'
            }`}>
              <h2 className="text-lg font-semibold mb-2">Overall Status</h2>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium">Status:</span> {health.overall.healthy ? 'Healthy' : 'Unhealthy'}
                </div>
                <div>
                  <span className="font-medium">Total Cameras:</span> {health.overall.totalCameras}
                </div>
                <div>
                  <span className="font-medium">Unhealthy:</span> {health.overall.unhealthyCount}
                </div>
              </div>
              <div className="text-xs mt-2">
                Last updated: {new Date(health.timestamp).toLocaleString()}
              </div>
            </div>

            {/* Individual Streams */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Individual Streams</h2>
              <div className="grid gap-4">
                {health.streams.map((stream) => (
                  <div
                    key={stream.cameraId}
                    className={`p-4 rounded-lg border ${
                      stream.isHealthy
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Camera {stream.cameraId}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        stream.isHealthy
                          ? 'bg-green-200 text-green-800'
                          : 'bg-red-200 text-red-800'
                      }`}>
                        {stream.isHealthy ? 'Healthy' : 'Unhealthy'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Playlist:</span> {stream.hasPlaylist ? 'Yes' : 'No'}
                      </div>
                      <div>
                        <span className="font-medium">Segments:</span> {stream.segmentCount}
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium">Last Segment:</span> {formatTime(stream.lastSegmentTime)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {loading && !health && (
          <div className="text-center py-8">
            <div className="text-lg">Loading health data...</div>
          </div>
        )}
      </div>
    </div>
  );
} 