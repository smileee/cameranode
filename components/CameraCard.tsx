'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { Camera } from "@/cameras.config";
import { useCameraStatus, CameraStatusIndicator } from "./CameraStatus";
import RecordingPreview from "./RecordingPreview";
import { Video } from "tabler-icons-react";

interface LatestRecording {
    videoUrl: string;
    thumbUrl: string;
}

export default function CameraCard({ camera }: { camera: Camera }) {
    const statuses = useCameraStatus();
    const [latest, setLatest] = useState<LatestRecording | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const status = statuses[camera.id]?.status || 'initializing';

    useEffect(() => {
        fetch(`/api/recordings/${camera.id}/latest`)
            .then(res => {
                if (!res.ok) return null;
                return res.json();
            })
            .then(data => setLatest(data))
            .finally(() => setIsLoading(false));
    }, [camera.id]);

    return (
        <Link 
          href={`/camera/${camera.id}`}
          className="group block bg-card rounded-lg border border-border shadow-sm transition-all hover:shadow-md hover:-translate-y-1"
        >
            <div className="relative w-full aspect-video bg-muted rounded-t-lg overflow-hidden">
                {isLoading ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <p className="text-xs text-muted-foreground">Loading preview...</p>
                    </div>
                ) : latest ? (
                    <RecordingPreview thumbUrl={latest.thumbUrl} videoUrl={latest.videoUrl} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-black">
                        <Video size={40} className="text-muted-foreground" />
                    </div>
                )}
            </div>
            <div className="p-4">
                <h2 className="text-lg font-semibold text-card-foreground">{camera.name}</h2>
                <div className="mt-2">
                    <CameraStatusIndicator status={status} />
                </div>
            </div>
        </Link>
    );
} 