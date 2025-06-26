'use client';

import { useEffect, useState } from 'react';
import { Camera } from '@/cameras.config';
import { VideoOff } from 'tabler-icons-react';

export default function LatestRecordingPlayer({ camera }: { camera: Camera }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/recordings/${camera.id}/latest`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to fetch latest recording');
        }
        return res.json();
      })
      .then((data) => {
        setVideoUrl(data.videoUrl);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
      });
  }, [camera.id]);

  if (error) {
    return (
      <div className="aspect-video bg-black rounded-lg flex flex-col items-center justify-center text-center p-4">
        <VideoOff size={48} className="text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-white">Could Not Load Video</h3>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }
  
  if (!videoUrl) {
    return (
        <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
            <p className="text-white">Loading latest recording...</p>
        </div>
    );
  }

  return (
    <video
      key={videoUrl}
      src={videoUrl}
      controls
      autoPlay
      muted
      loop
      playsInline
      className="w-full h-full object-contain aspect-video rounded-lg"
    />
  );
} 