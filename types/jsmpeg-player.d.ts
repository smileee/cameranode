// Type definitions for jsmpeg-player
// This is not an exhaustive definition, but covers the basic use case.

export interface JSMpegPlayerOptions {
  canvas: HTMLCanvasElement;
  autoplay?: boolean;
  loop?: boolean;
  // Add other options as needed
}

export declare class JSMpegPlayer {
  constructor(url: string, options: JSMpegPlayerOptions);
  destroy(): void;
  play(): void;
  pause(): void;
  stop(): void;
}

// Extend the global Window interface
declare global {
  interface Window {
    JSMpeg: {
      Player: typeof JSMpegPlayer;
    };
  }
}
