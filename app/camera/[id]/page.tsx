import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CAMERAS } from '@/cameras.config';
import { ChevronLeft, Archive } from 'tabler-icons-react';
import LatestRecordingPlayer from '@/components/LatestRecordingPlayer';

export default function CameraPage({ params }: { params: { id: string } }) {
  const camera = CAMERAS.find(c => c.id === params.id);

  if (!camera) {
    notFound();
  }

  return (
    <main className="min-h-screen w-full bg-background">
      <div className="container mx-auto px-4 py-8">
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-6 gap-4">
          <div>
            <Link 
              href="/" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-2"
            >
              <ChevronLeft size={16} /> All Cameras
            </Link>
            <h1 className="text-3xl font-bold text-foreground">{camera.name}</h1>
          </div>
          <Link 
            href={`/recordings/${camera.id}`}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-md shadow-sm hover:opacity-90 transition-opacity"
          >
            <Archive size={16} />
            View Recordings
          </Link>
        </header>
        
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
            <LatestRecordingPlayer camera={camera} />
        </div>
      </div>
    </main>
  );
} 