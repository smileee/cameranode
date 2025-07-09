'use client';

import { useState, useEffect } from 'react';
import { Camera } from '@/cameras.config';
import LiveStream from '@/components/LiveStream';

// Define the type for a processed recording
interface Recording {
    id: string;
    timestamp: string;
    label: string;
    url: string;
}

const MediaLibrary = ({ camera }: { camera: Camera }) => {
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchRecordings = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/media/${camera.id}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch recordings');
                }
                const data: Recording[] = await response.json();
                setRecordings(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRecordings();
        // Set up a poller to refresh the recordings every 30 seconds
        const intervalId = setInterval(fetchRecordings, 30000);

        // Cleanup interval on component unmount
        return () => clearInterval(intervalId);
    }, [camera.id]);

    return (
        <div className="p-4 bg-gray-900 text-white rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4">Media Library</h2>
            {isLoading && <p>Loading media...</p>}
            {error && <p className="text-red-500">Error: {error}</p>}
            {!isLoading && recordings.length === 0 && (
                <p>No recordings available for this camera yet.</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recordings.map(rec => (
                    <div key={rec.id} className="bg-gray-800 rounded-lg overflow-hidden shadow-md">
                        <video controls preload="metadata" className="w-full">
                            <source src={rec.url} type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                        <div className="p-4">
                            <p className="text-sm text-gray-400">
                                {new Date(rec.timestamp).toLocaleString()}
                            </p>
                            <p className="font-semibold">{rec.label}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


const CameraClient = ({ camera }: { camera: Camera }) => {
    const liveStreamUrl = `/api/media/${camera.id}/live/live.m3u8`;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold mb-4">{camera.name}</h1>
                <div className="aspect-video bg-black rounded-lg shadow-lg">
                    <LiveStream src={liveStreamUrl} />
                </div>
            </div>
            <MediaLibrary camera={camera} />
        </div>
    );
};

export default CameraClient; 