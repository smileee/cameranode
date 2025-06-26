'use client';

import { useState, useEffect, createContext, useContext } from 'react';

type CameraStatus = 'recording' | 'error' | 'restarting' | 'initializing';
type CameraStatuses = Record<string, { status: CameraStatus, lastUpdate: number }>;

const CameraStatusContext = createContext<CameraStatuses>({});

export const CameraStatusProvider = ({ children }: { children: React.ReactNode }) => {
    const [statuses, setStatuses] = useState<CameraStatuses>({});

    useEffect(() => {
        const ws = new WebSocket('ws://localhost:8081');

        ws.onopen = () => console.log('[WSS] Frontend connected.');
        ws.onclose = () => console.log('[WSS] Frontend disconnected.');
        ws.onerror = (err) => console.error('[WSS] Frontend connection error:', err);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setStatuses(data);
            } catch (e) {
                console.error('[WSS] Failed to parse status update:', e);
            }
        };

        return () => {
            ws.close();
        };
    }, []);

    return (
        <CameraStatusContext.Provider value={statuses}>
            {children}
        </CameraStatusContext.Provider>
    );
};

export const useCameraStatus = () => {
    return useContext(CameraStatusContext);
};

interface IndicatorProps {
    status: CameraStatus;
}

export const CameraStatusIndicator = ({ status }: IndicatorProps) => {
    const statusConfig = {
        recording: { text: 'Recording', color: 'bg-green-500' },
        restarting: { text: 'Restarting', color: 'bg-yellow-500' },
        error: { text: 'Error', color: 'bg-red-500' },
        initializing: { text: 'Initializing', color: 'bg-gray-500' }
    };

    const { text, color } = statusConfig[status] || statusConfig.initializing;

    return (
        <div className="flex items-center gap-2">
            <div className={`relative flex h-3 w-3`}>
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${color}`}></span>
            </div>
            <span className="text-xs text-muted-foreground">{text}</span>
        </div>
    );
}; 