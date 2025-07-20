export interface Camera {
  id: string;
  name: string;
  rtspUrl: string;
  enabled?: boolean;
  mock?: boolean; // For development/testing
}

export interface Speaker {
  id: string;
  name: string;
  rtspUrl: string;
}

// Check if we're running on the Raspberry Pi or locally
const isRaspberryPi = process.platform === 'linux' && process.arch === 'arm64';
const isDevelopment = process.env.NODE_ENV !== 'production';
const isMac = process.platform === 'darwin';

// Force mock mode on Mac or when not on Raspberry Pi
const forceMockMode = isMac || (!isRaspberryPi && isDevelopment);

// Mock RTSP URLs for development (when cameras are not accessible)
const MOCK_RTSP_URL = 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

console.log('[Camera Config] Environment detection:', {
  platform: process.platform,
  arch: process.arch,
  isRaspberryPi,
  isDevelopment,
  isMac,
  forceMockMode
});

export const CAMERAS: Camera[] = [
  {
    id: '1',
    name: 'Cam 1 (YARD CAM)',
    rtspUrl: forceMockMode ? MOCK_RTSP_URL : 'rtsp://192.168.9.232:554',
    enabled: true,
    mock: forceMockMode
  },
  {
    id: '2',
    name: 'Cam 2 (SIDE CAM)',
    rtspUrl: forceMockMode ? MOCK_RTSP_URL : 'rtsp://192.168.9.161:554',
    enabled: true,
    mock: forceMockMode
  }
]; 

export const SPEAKERS: Speaker[] = [
  {
    id: '1',
    name: 'Speaker 1',
    rtspUrl: 'http://192.168.9.111',
  }
];