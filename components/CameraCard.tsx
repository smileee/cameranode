'use client';

import { useState, useEffect } from 'react';
import { IconPlayerPlayFilled, IconPhoto, IconAerialLift, IconWifiOff } from '@tabler/icons-react';
import Link from 'next/link';
import type { Camera } from '@/cameras.config';
import LiveStream from './LiveStream'; // Assuming LiveStream is in the same directory

interface CameraCardProps {
  camera: Camera;
}

export default function CameraCard({ camera }: CameraCardProps) {
  const [status, setStatus] = useState<'loading' | 'online' | 'offline'>('loading');

  useEffect(() => {
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const statusRes = await fetch(`/api/camera/${camera.id}/status`);
        if (isMounted) {
          const { status: currentStatus } = await statusRes.json();
          setStatus(currentStatus);
        }
      } catch (error) {
        console.error(`[CameraCard ${camera.id}] Error fetching status:`, error);
        if (isMounted) {
          setStatus('offline');
        }
      }
    };

    fetchStatus();
    // Refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [camera.id]);

  const StatusPulse = () => (
    <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
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
        
        {status === 'online' ? (
          <LiveStream src={`/api/media/${camera.id}/live/live.m3u8`} isMuted={true} />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-neutral-900">
            {status === 'loading' ? (
              <div className="w-8 h-8 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin"></div>
            ) : (
              <>
                <IconWifiOff size={40} className="text-neutral-600 mb-2" />
                <span className="text-neutral-500 text-sm">Offline</span>
              </>
            )}
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent transition-opacity duration-300 opacity-100 group-hover:opacity-50"></div>
        
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="bg-black/50 backdrop-blur-sm rounded-full p-4">
                <IconPlayerPlayFilled size={32} className="text-white" />
            </div>
        </div>
        
        <StatusPulse />
        
        <div className="absolute bottom-0 left-0 p-4 z-10">
            <h3 className="font-semibold text-white">{camera.name}</h3>
        </div>
      </div>
    </Link>
  );
}
