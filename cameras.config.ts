export interface Camera {
  id: string;
  name: string;
  rtspUrl: string;
}

export const CAMERAS: Camera[] = [
  {
    id: '8d5f31df',
    name: 'Backyard',
    rtspUrl: 'rtsp://192.168.9.231:554',
  },
  {
    id: '2',
    name: 'Cam 2',
    rtspUrl: 'rtsp://192.168.9.161:554',
  },
]; 