'use client';

import { useState, useEffect } from 'react';
import { IconPlayerPlayFilled, IconWifiOff, IconMaximize } from '@tabler/icons-react';
import Link from 'next/link';
import type { Camera } from '@/cameras.config';
import LiveStream from './LiveStream';

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
    const interval = setInterval(fetchStatus, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [camera.id]);

  const StatusIndicator = () => (
    <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
      <div className={`flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-0.5 text-xs font-semibold ${status === 'online' ? 'text-green-400' : 'text-red-400'}`}>
        <span className={`relative flex h-2 w-2`}>
          {status === 'online' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
        </span>
        {status === 'online' ? 'LIVE' : 'OFFLINE'}
      </div>
    </div>
  );

  return (
    <div className="group relative aspect-video w-full overflow-hidden rounded-lg bg-neutral-900 border border-neutral-800 
                   transition-all duration-300 hover:border-neutral-700 hover:shadow-xl hover:shadow-black/20">
      
      <Link href={`/camera/${camera.id}`} className="block w-full h-full">
        {status === 'online' ? (
          <LiveStream src={`/api/media/live/${camera.id}/live.m3u8`} />
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
      </Link>
      
      {/* Overlay and Play Icon */}
      <Link href={`/camera/${camera.id}`} className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent transition-opacity duration-300 opacity-100 group-hover:opacity-40"></div>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="bg-black/50 backdrop-blur-sm rounded-full p-4">
            <IconPlayerPlayFilled size={32} className="text-white" />
          </div>
        </div>
      </Link>

      <StatusIndicator />

      {/* Expand Button */}
      <button 
        onClick={(e) => { 
          e.stopPropagation(); 
          alert('Modal view not implemented yet.'); 
        }} 
        className="absolute top-3 right-3 z-10 p-1.5 bg-black/40 rounded-full text-white/70 hover:text-white hover:bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300"
        aria-label="Expand video"
      >
        <IconMaximize size={18} />
      </button>
      
      <div className="absolute bottom-0 left-0 p-4 z-10">
        <h3 className="font-semibold text-white drop-shadow-md">{camera.name}</h3>
      </div>
    </div>
  );
}
