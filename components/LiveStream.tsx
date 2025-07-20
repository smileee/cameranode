'use client';

import { useEffect, useRef, RefObject, useState } from 'react';
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
  /**
   * Callback function called when a stream error occurs.
   */
  onError?: (error: string) => void;
}

export default function LiveStream({ src, controls = false, videoRef: parentRef, onError }: LiveStreamProps) {
  const internalRef = useRef<HTMLVideoElement>(null);
  const videoRef = parentRef || internalRef; // Use parent ref if provided, otherwise use internal
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const initializeHls = () => {
    const video = videoRef.current;
    if (!video) return;

    // Destroy existing HLS instance if any
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported() && src.endsWith('m3u8')) {
      const hls = new Hls({
        // Infinite retries on fatal errors
        maxMaxBufferLength: 120, // Keep up to 2 minutes in buffer
        
        // Retry logic
        manifestLoadingMaxRetry: 10,
        manifestLoadingRetryDelay: 2000, // 2 seconds
        manifestLoadingMaxRetryTimeout: 20000, // 20 seconds
        
        fragLoadingMaxRetry: 15,
        fragLoadingRetryDelay: 2000, // 2 seconds
        fragLoadingMaxRetryTimeout: 20000, // 20 seconds

        // Level loading settings
        levelLoadingMaxRetry: 10,
        levelLoadingRetryDelay: 2000, // 2 seconds
        levelLoadingMaxRetryTimeout: 20000, // 20 seconds

        // General settings for stability
        liveSyncDurationCount: 3, // Segments from edge to sync
        liveMaxLatencyDurationCount: 5, // Segments from edge to seek
      });

      // This will automatically recover from most media errors
      // without us needing to do anything manually.
      hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
              switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                      console.error('HLS.js: Fatal network error encountered, trying to recover...');
                      hls?.startLoad();
                      break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                      console.error('HLS.js: Fatal media error encountered, trying to recover...');
                      hls?.recoverMediaError();
                      break;
                  default:
                      // Cannot recover, destroy HLS instance
                      console.error('HLS.js: Unrecoverable fatal error encountered, destroying instance.');
                      hls?.destroy();
                      break;
              }
          }
      });

      hls.loadSource(src);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl') && src.endsWith('m3u8')) {
      // Native HLS support (e.g., Safari) for live streams
      setError(null);
      setIsLoading(false);
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(error => {
          console.log('[HLS Player] Native autoplay was prevented:', error);
        });
      });
      video.addEventListener('error', (e) => {
        console.error('[Native HLS Error]', e);
        const errorMessage = 'Native HLS playback error';
        setError(errorMessage);
        onError?.(errorMessage);
      });
    } else {
      // Standard MP4 file
      setError(null);
      setIsLoading(false);
      video.src = src;
      video.play().catch(error => {
        console.log('[MP4 Player] Autoplay was prevented:', error);
      });
    }
  };

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    initializeHls();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, videoRef]);

  // Auto-recovery mechanism
  useEffect(() => {
    if (error && src.endsWith('m3u8')) {
      const recoveryTimer = setTimeout(() => {
        console.log('[HLS] Attempting auto-recovery...');
        setError(null);
        setIsLoading(true);
        initializeHls();
      }, 5000); // Wait 5 seconds before attempting recovery

      return () => clearTimeout(recoveryTimer);
    }
  }, [error, src]);

  return (
    <div className="w-full h-full bg-black relative">
      <video
        ref={videoRef}
        controls={controls}
        muted
        autoPlay
        playsInline
        className="w-full h-full object-contain"
      />
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-white text-lg">Loading stream...</div>
        </div>
      )}
      
      {/* Error indicator */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
          <div className="text-white text-center">
            <div className="text-lg mb-2">Stream Error</div>
            <div className="text-sm text-gray-300">{error}</div>
            <div className="text-xs text-gray-400 mt-2">Attempting to reconnect...</div>
          </div>
        </div>
      )}
    </div>
  );
}

