export interface Event {
    id: string;
    timestamp: string;
    cameraId: string;
    type: 'detection' | 'custom';
    label: string;
    status: 'pending' | 'processed' | 'error';
    videoPath?: string;
    payload?: any;
} 