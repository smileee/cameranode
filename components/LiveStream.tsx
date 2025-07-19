'use client';

import { useEffect, useRef, RefObject } from 'react';
import Hls from 'hls.js';

interface LiveStreamProps {
  /**
   * The URL of the HLS playlist file (live.m3u8) or a direct MP4 file.
   */
  src: string;
  /**
   * Whether to show the native video controls.
   * Defaults to false.
   */
  controls?: boolean;
  videoRef?: RefObject<HTMLVideoElement>; // Make the ref optional
}

export default function LiveStream({ src, controls = false, videoRef: parentRef }: LiveStreamProps) {
  const internalRef = useRef<HTMLVideoElement>(null);
  const videoRef = parentRef || internalRef; // Use parent ref if provided, otherwise use internal

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    if (Hls.isSupported() && src.endsWith('m3u8')) {
      hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(error => {
          console.log('[HLS Player] Autoplay was prevented:', error);
          // Browsers may prevent autoplay. We can show a play button here if needed.
        });
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl') && src.endsWith('m3u8')) {
      // Native HLS support (e.g., Safari) for live streams
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(error => {
          console.log('[HLS Player] Native autoplay was prevented:', error);
        });
      });
    } else {
      // Standard MP4 file
      video.src = src;
      video.play().catch(error => {
        console.log('[MP4 Player] Autoplay was prevented:', error);
      });
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [src, videoRef]);

  return (
    <div className="w-full h-full bg-black">
      <video
        ref={videoRef}
        controls={controls}
        muted
        autoPlay
        playsInline
        className="w-full h-full object-contain"
      />
    </div>
  );
}
