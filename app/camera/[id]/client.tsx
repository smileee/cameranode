'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { IconStar, IconDownload, IconInfoCircle, IconStarFilled, IconPlayerPlayFilled, IconArrowLeft, IconPhotoOff, IconVideoOff } from '@tabler/icons-react';
import { Camera } from '@/cameras.config';
import LiveStream from '@/components/LiveStream';

// --- Types ---
interface Event {
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

// A dedicated component for the media row to handle image loading state.
function MediaTableRow({ item, onSelect }: { item: MediaItem, onSelect: (url: string) => void }) {
    const [thumbError, setThumbError] = useState(false);
    const thumbnailUrl = `/api/media/${item.thumbnail}`;
    const mediaUrl = `/api/media/${item.id}`;
    const friendlyName = item.events[0]?.label || item.events[0]?.type.replace(/_/g, ' ') || 'Recording';

    return (
        <tr 
            className="border-b border-neutral-800/80 hover:bg-neutral-800/60 transition-colors duration-200 cursor-pointer"
            onClick={() => item.video && onSelect(mediaUrl)}
        >
            <td className="p-3">
                <div className="w-28 h-[4.5rem] bg-neutral-800 rounded-md flex items-center justify-center">
                    {thumbError ? (
                        <IconPhotoOff size={24} className="text-neutral-500" />
                    ) : (
                        <Image 
                            src={thumbnailUrl} 
                            alt={`Thumbnail for ${item.fileName}`} 
                            width={112} 
                            height={72} 
                            className="w-full h-full object-cover rounded-md" 
                            unoptimized 
                            onError={() => setThumbError(true)}
                        />
                    )}
                </div>
            </td>
            <td className="px-4 py-3 capitalize font-medium text-neutral-200">
                {friendlyName}
            </td>
            <td className="px-4 py-3 text-xs text-neutral-400">
                {item.formattedDate}
            </td>
        </tr>
    );
}


// --- Library Component (previously LibraryClient) ---
function Library({ cameraId }: { cameraId: string }) {
    const [items, setItems] = useState<MediaItem[]>([]);
    const [totalPages, setTotalPages] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalVideoUrl, setModalVideoUrl] = useState<string | null>(null);
    const [infoModalData, setInfoModalData] = useState<{fileName:string; events:Event[]}|null>(null);
    
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const currentPage = parseInt(searchParams.get('page') || '1', 10);

    const createQueryString = useCallback((name: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set(name, value);
        return params.toString();
    }, [searchParams]);

    const fetchMedia = useCallback(async (page: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/media/${cameraId}?page=${page}&limit=12`);
            if (!response.ok) throw new Error('Failed to fetch media');
            const data = await response.json();
            setItems(data.mediaItems);
            setTotalPages(data.totalPages);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [cameraId]);

    useEffect(() => {
        fetchMedia(currentPage);
    }, [currentPage, fetchMedia]);

    const handleFavoriteToggle = async (filePath: string, currentStatus: boolean) => {
        setItems(currentItems => currentItems.map(item => item.id === filePath ? { ...item, isFavorite: !currentStatus } : item));
        try {
            await fetch('/api/media/favorite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath, isFavorite: !currentStatus }),
            });
        } catch (error) {
            console.error("Failed to update favorite status:", error);
            setItems(currentItems => currentItems.map(item => item.id === filePath ? { ...item, isFavorite: currentStatus } : item));
        }
    };

    if (isLoading) return <div className="text-center p-8 text-muted-foreground">Loading media...</div>;
    if (error) return <div className="text-center p-8 text-red-500">Error: {error}</div>;
    if (items.length === 0) return (
        <div className="flex flex-col items-center justify-center h-full text-neutral-500">
            <IconVideoOff size={48} />
            <p className="mt-4 text-sm">No recordings found.</p>
        </div>
    );
    
    return (
        <div className="flex flex-col h-full">
            <h2 className="text-2xl font-bold mb-4 px-1">Media Library</h2>
            <div className="flex-grow overflow-y-auto pr-1">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-neutral-500 uppercase sticky top-0 bg-black/80 backdrop-blur-sm">
                        <tr>
                            <th scope="col" className="px-3 py-3">Thumb</th>
                            <th scope="col" className="px-4 py-3">Event</th>
                            <th scope="col" className="px-4 py-3">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map(item => (
                            <MediaTableRow key={item.id} item={item} onSelect={setModalVideoUrl} />
                        ))}
                    </tbody>
                </table>
            </div>
            
            {/* Modals */}
            {modalVideoUrl && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50" onClick={() => setModalVideoUrl(null)}>
                    <div className="relative w-full max-w-4xl" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setModalVideoUrl(null)} className="absolute -top-10 right-0 text-white text-3xl font-bold">&times;</button>
                        <video className="w-full h-auto" src={modalVideoUrl} controls autoPlay>Your browser does not support the video tag.</video>
                    </div>
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