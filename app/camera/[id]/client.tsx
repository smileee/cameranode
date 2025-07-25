'use client';

import { Camera } from '@/cameras.config';
import LiveStream from '@/components/LiveStream';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { IconArrowLeft, IconRefresh } from '@tabler/icons-react';
import { Timeline, Event } from 'react-timeline-scribble';

interface DetectionEvent {
  id: string;
  timestamp: string;
  label: string;
  payload?: any;
  recordingPath?: string; // <-- Add recordingPath
  thumbnailPath?: string;
}

interface RecordingFile {
  filename: string;
  size: number;
  createdAt: string;
  url: string;
}

interface ClientPageProps {
  camera: Camera;
  events: DetectionEvent[];
}

export default function ClientPage({ camera, events: initialEvents }: ClientPageProps) {
  const [events, setEvents] = useState<DetectionEvent[]>(initialEvents);
  const [recordings, setRecordings] = useState<RecordingFile[]>([]);
  const [activeTab, setActiveTab] = useState<'live' | 'library'>('live');

  const liveStreamUrl = `/api/media/live/${camera.id}/live.m3u8`;
  const dvrStreamUrl = `/api/camera/${camera.id}/dvr/playlist.m3u8`;

  const [currentStreamUrl, setCurrentStreamUrl] = useState(liveStreamUrl);
  const [isLive, setIsLive] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [playlistStartTime, setPlaylistStartTime] = useState<number | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Effect to update the live clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch(`/api/events?cameraId=${camera.id}`);
        if (response.ok) {
          const newEvents: DetectionEvent[] = await response.json();
          setEvents(newEvents);
        }
      } catch (error) {
        console.error('Failed to fetch events:', error);
      }
    };

    const intervalId = setInterval(fetchEvents, 2000);

    return () => clearInterval(intervalId);
  }, [camera.id, initialEvents]);

  const handleGoLive = () => {
    setCurrentStreamUrl(liveStreamUrl);
    setIsLive(true);
    setStreamError(null);
  };

  const handleGoDvr = async () => {
    try {
      const response = await fetch(dvrStreamUrl);
      if (!response.ok) {
        console.error('Failed to fetch DVR playlist');
        return;
      }
      const startTimeHeader = response.headers.get('X-Playlist-Start-Time');
      if (startTimeHeader) {
        setPlaylistStartTime(parseInt(startTimeHeader, 10));
      }
      setCurrentStreamUrl(dvrStreamUrl);
      setIsLive(false);
      setStreamError(null);
    } catch (error) {
      console.error('Error fetching DVR playlist:', error);
    }
  };

  const handleRefreshStream = () => {
    setIsRefreshing(true);
    setStreamError(null);
    
    // Force a refresh by changing the URL slightly
    const timestamp = Date.now();
    const refreshUrl = `${currentStreamUrl}?t=${timestamp}`;
    setCurrentStreamUrl(refreshUrl);
    
    // Reset to original URL after a short delay
    setTimeout(() => {
      setCurrentStreamUrl(isLive ? liveStreamUrl : dvrStreamUrl);
      setIsRefreshing(false);
    }, 1000);
  };

  const handleTimelineEventClick = (timestamp: string) => {
    if (videoRef.current && playlistStartTime) {
      const eventTime = new Date(timestamp).getTime();
      const seekTime = (eventTime - playlistStartTime) / 1000;

      if (seekTime >= 0) {
        videoRef.current.currentTime = seekTime;
        videoRef.current.play();
      } else {
        console.warn('Cannot seek to a time before the recording started.');
      }
    } else {
      console.log('DVR not ready for seeking.');
    }
  };

  // This function is now simplified as it's only for displaying the list
  const handleEventListClick = (event: DetectionEvent) => {
    if (isLive) {
      // If we're live, maybe switch to DVR mode and seek? For now, just log.
      console.log('Event clicked from list while live:', event.id);
      handleTimelineEventClick(event.timestamp);
    } else {
      // If already in DVR mode, seek to the event time
      console.log('Event clicked from list in DVR mode:', event.id);
      handleTimelineEventClick(event.timestamp);
    }
  };

  // Auto-recovery for stream errors
  useEffect(() => {
    if (streamError && isLive) {
      const recoveryTimer = setTimeout(() => {
        console.log('[Camera Client] Attempting auto-recovery for stream error...');
        handleRefreshStream();
      }, 10000); // Wait 10 seconds before attempting recovery

      return () => clearTimeout(recoveryTimer);
    }
  }, [streamError, isLive]);

  useEffect(() => {
    const fetchRecordings = async () => {
      if (activeTab === 'library') {
        try {
          const response = await fetch(`/api/camera/${camera.id}/recordings`);
          if (response.ok) {
            const data: RecordingFile[] = await response.json();
            setRecordings(data);
          } else {
            console.error('Failed to fetch recordings');
            setRecordings([]);
          }
        } catch (error) {
          console.error('Error fetching recordings:', error);
          setRecordings([]);
        }
      }
    };

    fetchRecordings();
  }, [activeTab, camera.id]);

  const handleLibraryEventClick = (event: DetectionEvent) => {
    // Find the corresponding recording file
    const eventTime = new Date(event.timestamp).getTime();
    
    // Find the recording that CONTAINS this event time
    // This is a simplification; a more robust solution would check start/end times.
    // For now, we find the closest recording STARTING BEFORE the event.
    const associatedRecording = recordings
        .map(r => ({ ...r, createdAtTime: new Date(r.createdAt).getTime() }))
        .filter(r => r.createdAtTime <= eventTime)
        .sort((a, b) => b.createdAtTime - a.createdAtTime)[0];

    if (associatedRecording && videoRef.current) {
        // If the video is not already playing this recording, switch to it
        if (!currentStreamUrl.endsWith(associatedRecording.filename)) {
            handlePlayRecording(associatedRecording.url);
        }

        // We need a small delay to allow the video to load before seeking
        setTimeout(() => {
            if (videoRef.current) {
                // The seek time is the difference between the event and the start of the video file
                const recordingStartTime = new Date(associatedRecording.createdAt).getTime();
                const seekTime = (eventTime - recordingStartTime) / 1000;
                
                if (seekTime >= 0) {
                    videoRef.current.currentTime = seekTime;
                    videoRef.current.play();
                }
            }
        }, 500); // 500ms delay might need adjustment
    } else {
        console.warn('Could not find associated recording for this event.');
    }
  };

  const handlePlayRecording = (url: string) => {
    setCurrentStreamUrl(url);
    setIsLive(false); // Switch to "DVR" mode to show controls
    setStreamError(null);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background text-foreground">
      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <header className="flex justify-between items-center p-4 border-b border-border">
          <div>
            <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors">
              <IconArrowLeft size={16} className="mr-2" />
              Back to Cameras
            </Link>
            <h1 className="text-xl font-semibold mt-1">{camera.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleRefreshStream}
              disabled={isRefreshing}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              <IconRefresh size={14} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
              <button onClick={() => setActiveTab('live')} className={`px-3 py-1 text-sm rounded-md transition-colors ${activeTab === 'live' ? 'bg-white text-black' : 'bg-transparent text-white'}`}>
                Live
              </button>
              <button onClick={() => setActiveTab('library')} className={`px-3 py-1 text-sm rounded-md transition-colors ${activeTab === 'library' ? 'bg-white text-black' : 'bg-transparent text-white'}`}>
                Library
              </button>
            </div>
          </div>
        </header>

        <div className="flex-grow p-4 relative">
          <div className="bg-muted aspect-video w-full rounded-lg overflow-hidden relative">
            <div className="absolute top-4 right-4 z-10 flex items-center space-x-2">
              <span
                className={`px-3 py-1 text-sm font-semibold rounded-full ${
                  isLive ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300'
                }`}
              >
                {isLive ? 'LIVE' : 'DVR'}
              </span>
            </div>
            
            {/* Stream Error Overlay */}
            {streamError && (
              <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-20">
                <div className="text-white text-center p-4">
                  <div className="text-lg mb-2">Stream Error</div>
                  <div className="text-sm text-gray-300 mb-4">{streamError}</div>
                  <button 
                    onClick={handleRefreshStream}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Retry Connection
                  </button>
                </div>
              </div>
            )}
            
            <div className="w-full h-full bg-black flex items-center justify-center">
              <LiveStream
                  src={currentStreamUrl}
                  videoRef={videoRef}
                  controls={activeTab === 'library' || !isLive}
                  onError={(error) => setStreamError(error)}
                />
            </div>
          </div>

          {activeTab === 'library' && (
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* Recordings List */}
              <div className="p-4 bg-muted/50 border border-border rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Recorded Files</h3>
                <div className="h-40 overflow-y-auto">
                  {recordings.length > 0 ? (
                    <ul className="space-y-2">
                      {recordings.map((rec) => (
                        <li key={rec.filename} onClick={() => handlePlayRecording(rec.url)} className="p-2 rounded-md hover:bg-accent cursor-pointer flex justify-between items-center">
                          <div>
                            <p className="font-medium">{rec.filename}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(rec.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {(rec.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">No recordings found.</p>
                  )}
                </div>
              </div>
              {/* Event Timeline */}
              <div className="p-4 bg-muted/50 border border-border rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Event Timeline</h3>
                <div className="h-40 overflow-y-auto">
                  <Timeline>
                    {events.map((event) => (
                      <Event
                        key={event.id}
                        interval={new Date(event.timestamp).toLocaleString()}
                        title={event.label}
                        onClick={() => handleLibraryEventClick(event)}
                      />
                    ))}
                  </Timeline>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Sidebar */}
      <aside className="w-full md:w-80 border-l border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Detection Events</h2>
        </div>
        <div className="flex-grow overflow-y-auto p-2">
          {events.length > 0 ? (
            <ul>
              {events.map((event, index) => (
                <li
                  key={event.id}
                  className="mb-2 p-2 rounded-md flex items-center gap-3 cursor-pointer hover:bg-accent"
                  onClick={() => activeTab === 'library' ? handleLibraryEventClick(event) : handleEventListClick(event)}
                >
                  {event.thumbnailPath ? (
                    <img src={event.thumbnailPath} alt={`Thumbnail for ${event.label}`} className="w-20 h-12 object-cover rounded-md bg-muted" />
                  ) : (
                    <div className="w-20 h-12 bg-muted rounded-md" />
                  )}
                  <div>
                    <p className="font-semibold capitalize">{event.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(event.timestamp).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center p-8 text-muted-foreground">
              <p>No detection events yet.</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
} 