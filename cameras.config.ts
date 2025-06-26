export interface Camera {
  id: string;
  name: string;
  rtspUrl: string;
}

export const CAMERAS: Camera[] = [
  {
    id: '1',
    name: 'Backyard',
    rtspUrl: 'rtsp://192.168.9.231:554',
  },
  // {
  //   id: '2',
  //   name: 'Driveway Cam',
  //   rtspUrl: 'rtsp://...',
  // },
]; 