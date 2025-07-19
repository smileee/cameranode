'use client';

import { Camera } from '@/cameras.config';
import LiveStream from '@/components/LiveStream';
import { useEffect, useState, useRef } from 'react';
import { Timeline, Event } from 'react-timeline-scribble';

interface DetectionEvent {
  id: string;
  timestamp: string;
  label: string;
  payload?: any;
  recordingPath?: string; // <-- Add recordingPath
  thumbnailPath?: string;
}

interface ClientPageProps {
  camera: Camera;
  events: DetectionEvent[];
}

export default function ClientPage({ camera, events: initialEvents }: ClientPageProps) {
  const [events, setEvents] = useState<DetectionEvent[]>(initialEvents);
  const liveStreamUrl = `/api/media/live/${camera.id}/live.m3u8`;
  const dvrStreamUrl = `/api/camera/${camera.id}/dvr`;

  const [currentStreamUrl, setCurrentStreamUrl] = useState(liveStreamUrl);
  const [isLive, setIsLive] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

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
  };

  const handleGoDvr = () => {
    setCurrentStreamUrl(dvrStreamUrl);
    setIsLive(false);
  };

  const handleTimelineEventClick = (timestamp: string) => {
    // This is a simplified example.
    // A more robust solution would calculate the exact second to seek to
    // based on the event's timestamp relative to the start of the DVR buffer.
    if (videoRef.current) {
      // For now, just switch to DVR mode. Seeking requires more info.
      handleGoDvr();
      console.log(`Timeline event clicked: ${timestamp}. Seeking logic to be implemented.`);
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

  return (
    <div className="flex flex-col h-screen bg-black text-white p-4">
      <header className="flex justify-between items-center mb-4">
        <div>
          <a href="/" className="text-blue-400 hover:underline">&larr; Back to Cameras</a>
          <h1 className="text-2xl font-bold mt-2">{camera.name}</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleGoLive} className={`font-bold py-2 px-4 rounded transition-colors ${isLive ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
            Live
          </button>
          <button onClick={handleGoDvr} className={`font-bold py-2 px-4 rounded transition-colors ${!isLive ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
            DVR
          </button>
        </div>
      </header>

      <main className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-4" style={{maxHeight: 'calc(100vh - 100px)'}}>
        <div className="md:col-span-2 h-full flex flex-col relative">
          {isLive && (
            <div className="absolute top-2 right-2 z-10 bg-black bg-opacity-50 text-white p-2 rounded text-lg font-mono">
              {currentTime.toLocaleString()}
            </div>
          )}
          <div className="flex-grow">
            <LiveStream
              src={currentStreamUrl}
              videoRef={videoRef} // Pass ref to LiveStream component
              controls={!isLive} // Show controls only in DVR mode
            />
          </div>
          {!isLive && (
            <div className="w-full p-4 bg-gray-900 rounded-lg mt-4">
              <h3 className="text-lg font-bold mb-2">Recorded Events</h3>
              <div className="h-48 overflow-y-auto">
                <Timeline>
                  {events.map((event) => (
                    <Event
                      key={event.id}
                      interval={new Date(event.timestamp).toLocaleString()}
                      title={event.label}
                      onClick={() => handleTimelineEventClick(event.timestamp)}
                    >
                      {/* You can add more details here if you want */}
                    </Event>
                  ))}
                </Timeline>
              </div>
            </div>
          )}
        </div>
        <aside className="bg-gray-900 p-4 rounded-lg h-full overflow-y-auto">
          <h2 className="text-lg font-bold mb-4">Detection Events</h2>
          {events.length > 0 ? (
            <ul>
              {events.map((event, index) => (
                <li
                  key={event.id}
                  className={`mb-4 p-2 rounded flex items-center gap-4 cursor-pointer hover:bg-gray-700 bg-gray-800`}
                  onClick={() => handleEventListClick(event)}
                >
                  {event.thumbnailPath && (
                    <img src={event.thumbnailPath} alt={`Thumbnail for ${event.label}`} className="w-24 h-16 object-cover rounded" />
                  )}
                  <div>
                    <p className="font-bold text-blue-400">{event.label}</p>
                    <p className="text-sm text-gray-400">
                      {new Date(event.timestamp).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No detection events yet.</p>
          )}
        </aside>
      </main>
    </div>
  );
} 