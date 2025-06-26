declare module '@cycjimmy/jsmpeg-player' {
  interface JSMpegOptions {
    canvas: HTMLCanvasElement;
    audio?: boolean;
    videoBufferSize?: number;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
  }

  class Player {
    constructor(url: string, options: JSMpegOptions);
    destroy(): void;
  }

  const JSMpeg: {
    Player: typeof Player;
  };

  export default JSMpeg;
} 