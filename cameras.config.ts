export interface Camera {
  id: string;
  name: string;
  rtspUrl: string;
}

export const CAMERAS: Camera[] = [
  {
    id: '1',
    name: 'Cam 1 (BOX CAM)',
    rtspUrl: 'rtsp://192.168.9.232:554',
  }
  ,{
    id: '2',
    name: 'Cam 2 (PI CAM)',
    rtspUrl: 'rtsp://192.168.9.161:554',
  }
]; 