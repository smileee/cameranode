export interface Event {
    id: string;
    timestamp: string;
    cameraId: string;
    type: 'detection' | 'custom';
    label: string;
    status?: 'pending' | 'processed' | 'error' | 'completed' | 'failed';
    recordingPath?: string;
    thumbnailPath?: string;
    payload?: any;
} 