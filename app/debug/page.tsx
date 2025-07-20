'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconArrowLeft, IconRefresh, IconDeviceDesktop, IconCamera } from '@tabler/icons-react';

interface StreamHealth {
  cameraId: string;
  hasPlaylist: boolean;
  segmentCount: number;
  lastSegmentTime: number | null;
  isHealthy: boolean;
  isMock?: boolean;
  enabled?: boolean;
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

  const getStreamTypeIcon = (stream: StreamHealth) => {
    if (stream.isMock) {
      return <IconDeviceDesktop size={16} className="text-blue-500" />;
    }
    return <IconCamera size={16} className="text-green-500" />;
  };

  const getStreamTypeLabel = (stream: StreamHealth) => {
    if (stream.enabled === false) return 'Disabled';
    if (stream.isMock) return 'Development Mock';
    return 'Live Camera';
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
            <p className="text-sm text-muted-foreground mt-1">
              Development mode: Mock streams are being used for testing
            </p>
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
                      stream.enabled === false
                        ? 'bg-gray-50 border-gray-200'
                        : stream.isHealthy
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStreamTypeIcon(stream)}
                        <h3 className="font-semibold">Camera {stream.cameraId}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {getStreamTypeLabel(stream)}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          stream.enabled === false
                            ? 'bg-gray-200 text-gray-800'
                            : stream.isHealthy
                            ? 'bg-green-200 text-green-800'
                            : 'bg-red-200 text-red-800'
                        }`}>
                          {stream.enabled === false ? 'Disabled' : stream.isHealthy ? 'Healthy' : 'Unhealthy'}
                        </span>
                      </div>
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
                    
                    {stream.isMock && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                        <strong>Development Mode:</strong> This camera is using a mock stream because the real RTSP camera is not accessible from this network.
                      </div>
                    )}
                    
                    {stream.enabled === false && (
                      <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
                        <strong>Disabled:</strong> This camera has been disabled in the configuration.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Development Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">Development Information</h3>
              <div className="text-sm text-blue-700">
                <p className="mb-2">
                  You're running in development mode on a Mac. The system has automatically detected that the real RTSP cameras are not accessible and has switched to mock streams for testing.
                </p>
                <p>
                  <strong>Next steps:</strong>
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Deploy this code to your Raspberry Pi server to access real cameras</li>
                  <li>Ensure your cameras are accessible on the network (192.168.9.232 and 192.168.9.161)</li>
                  <li>Mock streams allow you to test the UI and basic functionality</li>
                </ul>
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