'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { IconStar, IconDownload, IconInfoCircle, IconStarFilled, IconPlayerPlayFilled, IconArrowLeft, IconPhotoOff, IconVideoOff, IconMovie } from '@tabler/icons-react';
import { Camera } from '@/cameras.config';
import LiveStream from '@/components/LiveStream';

// --- Types ---
interface Event {
    cameraId: string;
    timestamp: string;
    type: string;
    label?: string;
}

interface MediaItem {
    id: string;
    thumbnail: string;
    video: string | null;
    isFavorite: boolean;
    formattedDate: string;
    fileName: string;
    events: Event[];
}

interface CameraClientPageProps {
    camera: Camera;
}

// --- Row for an Event ---
function EventTableRow({ event, onGenerate, isGenerating }: { event: Event, onGenerate: (event: Event) => void, isGenerating: boolean }) {
    return (
        <tr className="border-b border-neutral-800/80">
            <td className="p-3">
                <div className="w-28 h-[4.5rem] bg-neutral-800 rounded-md flex items-center justify-center">
                    <IconMovie size={24} className="text-neutral-500" />
                </div>
            </td>
            <td className="px-4 py-3 capitalize font-medium text-neutral-200">
                {event.label || 'Event'}
            </td>
            <td className="px-4 py-3 text-xs text-neutral-400">
                {new Date(event.timestamp).toLocaleString()}
            </td>
            <td className="px-4 py-3 text-right">
                <button
                    onClick={() => onGenerate(event)}
                    disabled={isGenerating}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-3 rounded-md disabled:bg-neutral-600 disabled:cursor-not-allowed"
                >
                    {isGenerating ? 'Generating...' : 'Generate Video'}
                </button>
            </td>
        </tr>
    );
}


// --- Library Component ---
function Library({ cameraId }: { cameraId: string }) {
    const [events, setEvents] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [generatingEventId, setGeneratingEventId] = useState<string | null>(null);
    
    const fetchEvents = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/events?cameraId=${cameraId}`);
            if (!response.ok) throw new Error('Failed to fetch events');
            const data = await response.json();
            setEvents(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [cameraId]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    const handleGenerateVideo = async (event: Event) => {
        setGeneratingEventId(event.timestamp); // Use timestamp as a unique ID for the generation process
        try {
            const response = await fetch(`/api/camera/${cameraId}/record`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    timestamp: event.timestamp,
                    label: event.label,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate video');
            }

            // For now, we can just alert the user. A better approach would be to
            // switch to a "Recordings" tab or refresh a list of generated media.
            alert('Video generated successfully! Refresh the page to see it in your library (feature coming soon).');

        } catch (err: any) {
            setError(err.message);
            alert(`Error generating video: ${err.message}`);
        } finally {
            setGeneratingEventId(null);
            // Optionally, refresh the events list or a recordings list here
        }
    };

    if (isLoading) return <div className="text-center p-8 text-muted-foreground">Loading media...</div>;
    if (error) return <div className="text-center p-8 text-red-500">Error: {error}</div>;
    
    return (
        <div className="flex flex-col h-full">
            <h2 className="text-2xl font-bold mb-4 px-1">Event History</h2>
            {events.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                    <IconVideoOff size={48} />
                    <p className="mt-4 text-sm">No events found.</p>
                </div>
            ) : (
                <div className="flex-grow overflow-y-auto pr-1">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-neutral-500 uppercase sticky top-0 bg-black/80 backdrop-blur-sm">
                            <tr>
                                <th scope="col" className="px-3 py-3">Thumb</th>
                                <th scope="col" className="px-4 py-3">Event</th>
                                <th scope="col" className="px-4 py-3">Date</th>
                                <th scope="col" className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map(event => (
                                <EventTableRow
                                    key={event.timestamp}
                                    event={event}
                                    onGenerate={handleGenerateVideo}
                                    isGenerating={generatingEventId === event.timestamp}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// --- Main Page Component ---
export default function CameraClientPage({ camera }: CameraClientPageProps) {
    const liveStreamUrl = `/api/media/${camera.id}/live/live.m3u8`;

  return (
        <div className="flex flex-col h-screen bg-black text-white">
            <header className="flex items-center justify-between p-4 border-b border-neutral-800">
                <div>
                    <Link href="/" className="flex items-center text-neutral-400 hover:text-white transition-colors text-sm mb-1">
                        <IconArrowLeft size={16} className="mr-2" />
                        All Cameras
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight">{camera.name}</h1>
                </div>
            </header>
            <main className="flex flex-1 overflow-hidden">
                {/* Left Side: Live Player (2/3 width) */}
                <div className="w-2/3 h-full p-4">
                    <div className="w-full h-full rounded-lg overflow-hidden border border-neutral-800">
                       <LiveStream src={liveStreamUrl} />
                    </div>
                </div>

                {/* Right Side: Media Library (1/3 width) */}
                <aside className="w-1/3 h-full p-4 border-l border-neutral-800 flex flex-col">
                   <Library cameraId={camera.id} />
                </aside>
            </main>
    </div>
  );
} 