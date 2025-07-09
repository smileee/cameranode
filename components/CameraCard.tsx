'use client';

import { useState, useEffect } from 'react';
import { IconPlayerPlayFilled, IconPhoto, IconAerialLift } from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';
import type { Camera } from '@/cameras.config';

interface CameraCardProps {
  camera: Camera;
}

export default function CameraCard({ camera }: CameraCardProps) {
  const [status, setStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchStatusAndImage = async () => {
      try {
        // Fetch camera status
        const statusRes = await fetch(`/api/camera/${camera.id}/status`);
        if (!isMounted) return;
        const { status: currentStatus } = await statusRes.json();
        setStatus(currentStatus);

        // Fetch appropriate image based on status
        if (currentStatus === 'online') {
          // Fetch a live screenshot
          setImageUrl(`/api/camera/${camera.id}/screenshot?t=${Date.now()}`);
        } else {
          // Fetch the latest recorded thumbnail
          const latestThumbRes = await fetch(`/api/media/${camera.id}/latest`);
          if (!isMounted) return;
          if (latestThumbRes.ok) {
            const { thumbnailUrl } = await latestThumbRes.json();
            setImageUrl(thumbnailUrl);
          } else {
            setImageUrl(null); // No thumbnail found
          }
        }
      } catch (error) {
        console.error(`[CameraCard ${camera.id}] Error fetching status or image:`, error);
        if (isMounted) {
          setStatus('offline');
          setImageUrl(null);
        }
      }
    };

    fetchStatusAndImage();

    return () => {
      isMounted = false;
    };
  }, [camera.id]);

  const StatusPulse = () => (
    <div className="absolute top-3 right-3 flex items-center gap-2">
       <span className="relative flex h-3 w-3">
        {status === 'online' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
        <span className={`relative inline-flex rounded-full h-3 w-3 ${status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
      </span>
    </div>
  );

  return (
    <Link href={`/camera/${camera.id}`} className="group block">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-neutral-900 border border-neutral-800 
                     transition-all duration-300 group-hover:border-neutral-700 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.08)]">
        
        {status === 'loading' || imageError ? (
            <div className="flex h-full w-full items-center justify-center bg-neutral-800/50">
                {status === 'loading' ? 
                    <div className="w-8 h-8 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin"></div> :
                    <IconPhoto size={40} className="text-neutral-600" />
                }
            </div>
        ) : imageUrl ? (
          <Image
            src={imageUrl}
            alt={`Preview for ${camera.name}`}
            fill
            objectFit="cover"
            className={`transition-all duration-300 group-hover:scale-105 ${status === 'offline' ? 'saturate-0' : ''}`}
            unoptimized // Using unoptimized as these are dynamic external images
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutral-800/50">
            <IconPhoto size={40} className="text-neutral-600" />
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
        
        <StatusPulse />
        
        <div className="absolute bottom-0 left-0 p-4">
            <h3 className="font-semibold text-white">{camera.name}</h3>
            {/* <p className="text-sm text-neutral-400">{camera.description}</p> */}
        </div>
      </div>
    </Link>
  );
}
