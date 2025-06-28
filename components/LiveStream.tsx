'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import type { JSMpegPlayer } from '@/types/jsmpeg-player';

const JSMPEG_SCRIPT_URL = "https://cdn.jsdelivr.net/gh/phoboslab/jsmpeg@b5799bf/jsmpeg.min.js";

interface LiveStreamProps {
  streamUrl: string;
}

export default function LiveStream({ streamUrl }: LiveStreamProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<JSMpegPlayer | null>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [showButton, setShowButton] = useState(true);

  useEffect(() => {
    if (isScriptLoaded && !showButton) {
      const canvas = canvasRef.current;
      if (canvas) {
        playerRef.current = new window.JSMpeg.Player(streamUrl, {
          canvas: canvas,
          autoplay: true,
        });
      }
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [isScriptLoaded, streamUrl, showButton]);

  const handlePlayClick = () => {
    setShowButton(false);
  };

  return (
    <div className="w-full h-full relative">
      <Script 
        src={JSMPEG_SCRIPT_URL}
        onLoad={() => {
          console.log("JSMpeg script loaded.");
          setIsScriptLoaded(true);
        }}
      />
      <canvas ref={canvasRef} className="w-full h-full"></canvas>
      {showButton && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <button
            onClick={handlePlayClick}
            disabled={!isScriptLoaded}
            className="px-8 py-4 bg-gray-600 text-white font-bold rounded-lg shadow-lg hover:bg-gray-500 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isScriptLoaded ? 'Play Live Stream' : 'Loading Player...'}
          </button>
        </div>
      )}
    </div>
  );
}
