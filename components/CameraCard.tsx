'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { Camera } from '@/cameras.config';
import LiveStream from './LiveStream';
import { IconWifiOff } from '@tabler/icons-react';

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
    <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
      <div className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold text-white ${status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}>
        {status === 'online' ? 'Online' : 'Offline'}
      </div>
    </div>
  );

  return (
    <Link href={`/camera/${camera.id}`}>
      <div className="group relative aspect-video w-full overflow-hidden rounded-lg bg-muted border border-transparent 
                     transition-all duration-300 hover:border-accent">
        
        <div className="w-full h-full">
          {status === 'online' ? (
            <LiveStream src={`/api/media/live/${camera.id}/live.m3u8`} />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-muted">
              {status === 'loading' ? (
                <div className="w-6 h-6 border-2 border-border border-t-foreground rounded-full animate-spin"></div>
              ) : (
                <>
                  <IconWifiOff size={32} className="text-muted-foreground mb-2" />
                  <span className="text-muted-foreground text-sm">Offline</span>
                </>
              )}
            </div>
          )}
        </div>
        
        <StatusIndicator />
        
        <div className="absolute bottom-0 left-0 p-4 z-10">
          <h3 className="font-semibold text-foreground">{camera.name}</h3>
        </div>
      </div>
    </Link>
  );
}
