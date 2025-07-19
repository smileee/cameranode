'use client';

import { Camera } from '@/cameras.config';
import LiveStream from '@/components/LiveStream';
import { useEffect, useState } from 'react';

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
  const [currentStreamUrl, setCurrentStreamUrl] = useState(liveStreamUrl);

  useEffect(() => {
    const sortedInitial = [...initialEvents].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setEvents(sortedInitial);

    const fetchEvents = async () => {
      try {
        const response = await fetch(`/api/events?cameraId=${camera.id}`);
        if (response.ok) {
          const newEvents: DetectionEvent[] = await response.json();
          newEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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
  };
  
  const handleEventClick = (event: DetectionEvent) => {
    if (event.recordingPath) {
      console.log(`Switching to event recording: ${event.recordingPath}`);
      setCurrentStreamUrl(event.recordingPath);
    } else {
      console.log(`No recording available for event: ${event.id}`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white p-4">
      <header className="flex justify-between items-center mb-4">
        <div>
          <a href="/" className="text-blue-400 hover:underline">&larr; Back to Cameras</a>
          <h1 className="text-2xl font-bold mt-2">{camera.name}</h1>
        </div>
        <button onClick={handleGoLive} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors">
          Go Live
        </button>
      </header>

      <main className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-4" style={{maxHeight: 'calc(100vh - 100px)'}}>
        <div className="md:col-span-2 h-full">
          <LiveStream 
            src={currentStreamUrl} 
            controls={currentStreamUrl.endsWith('.mp4')} 
          />
        </div>
        <aside className="bg-gray-900 p-4 rounded-lg h-full overflow-y-auto">
          <h2 className="text-lg font-bold mb-4">Detection Events</h2>
          {events.length > 0 ? (
            <ul>
              {events.map((event) => (
                <li 
                  key={event.id} 
                  className={`mb-4 p-2 bg-gray-800 rounded flex items-center gap-4 ${event.recordingPath ? 'cursor-pointer hover:bg-gray-700' : 'cursor-not-allowed opacity-60'}`} 
                  onClick={() => handleEventClick(event)}
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