'use client';

import { useEffect, useRef } from 'react';

export default function LiveStream() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;

    // Load JSMpeg from CDN
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsmpeg-player@3.0.3/build/jsmpeg.min.js';
    script.async = true;

    script.onload = () => {
      // @ts-ignore - JSMpeg is loaded from CDN
      new JSMpeg.Player(`ws://localhost:9999`, {
        canvas: canvasRef.current,
        audio: false,
        videoBufferSize: 1024*1024,
        preserveDrawingBuffer: true,
      });
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef}
      className="w-full h-full"
    />
  );
} 