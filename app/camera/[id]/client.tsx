'use client';

import { Camera } from '@/cameras.config';
import Link from 'next/link';
import { IconArrowLeft, IconPhoto, IconWalk, IconVolume, IconPointFilled } from '@tabler/icons-react';
import { formatInTimeZone } from 'date-fns-tz';

interface Event {
    cameraId: string;
    timestamp: string;
    type: string;
    label?: string;
      }

interface CameraClientPageProps {
    camera: Camera;
    events: Event[];
    }

const EventIcon = ({ type }: { type: string }) => {
    switch (type) {
        case 'motion':
        case 'motion_detected':
            return <IconWalk size={18} />;
        case 'audio':
        case 'audio_detected':
            return <IconVolume size={18} />;
        default:
            return <IconPointFilled size={18} />;
        }
}

export default function CameraClientPage({ camera, events }: CameraClientPageProps) {
  return (
    <div className="bg-background min-h-screen text-foreground">
        <main className="container mx-auto p-4 md:p-8">
            <header className="flex items-center justify-between mb-8">
                <div>
                    <Link href="/" className="flex items-center text-muted-foreground hover:text-foreground transition-colors text-sm mb-1">
                        <IconArrowLeft size={16} className="mr-2" />
                        Todas as Câmeras
                    </Link>
                    <h1 className="text-4xl font-bold tracking-tight">{camera.name}</h1>
                </div>
                <Link href={`/camera/${camera.id}/library`} className="btn btn-ghost">
                    <IconPhoto size={18} className="mr-2" />
                    Ver Biblioteca
          </Link>
            </header>

            <div className="bg-card border border-border rounded-lg p-2">
                <div className="w-full">
                    <div className="px-4 py-2 border-b border-border grid grid-cols-[auto,1fr,auto] gap-4 items-center">
                        <div className="text-muted-foreground font-medium text-sm">Evento</div>
                        <div></div>
                        <div className="text-muted-foreground font-medium text-sm text-right">Data</div>
                    </div>
                    {events.length > 0 ? (
                        <div className="divide-y divide-border">
                            {events.map((event) => (
                                <div key={event.timestamp} className="px-4 py-3 grid grid-cols-[auto,1fr,auto] gap-4 items-center hover:bg-secondary transition-colors">
                                    <div className="text-muted-foreground"><EventIcon type={event.type} /></div>
                                    <div className="font-medium text-foreground capitalize">
                                        {event.type.replace(/_/g, ' ')}
                                        {event.label && <span className="text-muted-foreground ml-2 font-normal">{event.label}</span>}
                                    </div>
                                    <div className="text-muted-foreground text-sm text-right font-mono">
                                        {formatInTimeZone(new Date(event.timestamp), 'America/New_York', 'MMM dd, hh:mm:ss a')}
                                    </div>
                                </div>
                            ))}
        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            <p>Nenhum evento registrado para esta câmera.</p>
        </div>
                    )}
        </div>
      </div>
    </main>
    </div>
  );
} 