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
const isDevelopment = process.env.NODE_ENV === 'development';

// Mock RTSP URLs for development (when cameras are not accessible)
const MOCK_RTSP_URL = 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

export const CAMERAS: Camera[] = [
  {
    id: '1',
    name: 'Cam 1 (BOX CAM)',
    rtspUrl: isRaspberryPi || !isDevelopment ? 'rtsp://192.168.9.232:554' : MOCK_RTSP_URL,
    enabled: true,
    mock: !isRaspberryPi && isDevelopment
  },
  {
    id: '2',
    name: 'Cam 2 (PI CAM)',
    rtspUrl: isRaspberryPi || !isDevelopment ? 'rtsp://192.168.9.161:554' : MOCK_RTSP_URL,
    enabled: true,
    mock: !isRaspberryPi && isDevelopment
  }
]; 

export const SPEAKERS: Speaker[] = [
  {
    id: '1',
    name: 'Speaker 1',
    rtspUrl: 'http://192.168.9.111',
  }
];