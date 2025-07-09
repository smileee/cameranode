'use client';

import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface LiveStreamProps {
  /**
   * The URL of the HLS playlist file (live.m3u8).
   */
  src: string;
}

export default function LiveStream({ src }: LiveStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(error => {
          console.log('[HLS Player] Autoplay was prevented:', error);
          // Browsers may prevent autoplay. We can show a play button here if needed.
        });
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (e.g., Safari)
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(error => {
          console.log('[HLS Player] Native autoplay was prevented:', error);
        });
      });
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [src]);

  return (
    <div className="w-full h-full bg-black">
      <video
        ref={videoRef}
        controls
        muted
        autoPlay
        playsInline
        className="w-full h-full object-contain"
      />
    </div>
  );
}
