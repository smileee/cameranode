'use client';

import { useState, useRef, useEffect } from 'react';

type RecordingPreviewProps = {
  thumbUrl: string;
  videoUrl: string;
};

export default function RecordingPreview({ thumbUrl, videoUrl }: RecordingPreviewProps) {
  const [thumbFailed, setThumbFailed] = useState(!thumbUrl);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Only run the canvas logic if the thumbnail image has failed to load
    if (!thumbFailed) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';

    let hasDrawn = false;

    const drawFrame = () => {
      if (hasDrawn || !ctx || video.videoWidth === 0) return;
      hasDrawn = true;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      video.pause();
    };
    
    const onCanPlay = () => {
      if (!hasDrawn) {
        video.currentTime = 0.5; // Seek to a safe point to avoid blank frames
      }
    };

    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('seeked', drawFrame);

    video.load();

    return () => {
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('seeked', drawFrame);
    };
  }, [thumbFailed, videoUrl]);


  if (thumbFailed) {
    // Fallback to rendering video frame on a canvas
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center">
        <canvas ref={canvasRef} className="w-full h-full object-cover" />
      </div>
    );
  }

  // Attempt to load the thumbnail image by default
  return (
    <img
      src={thumbUrl}
      alt={`Preview of ${videoUrl}`}
      className="w-full h-full object-cover"
      onError={() => setThumbFailed(true)}
    />
  );
}
