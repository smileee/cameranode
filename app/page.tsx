import { CAMERAS } from "@/cameras.config";
import CameraCard from "@/components/CameraCard";
import { promises as fs } from 'fs';
import path from 'path';

async function getLatestThumbnail(cameraId: string): Promise<string | null> {
    const recordingsDir = path.join(process.cwd(), 'recordings', cameraId);
    try {
        const files = (await fs.readdir(recordingsDir))
            .filter(f => f.endsWith('.jpg'))
            .sort((a, b) => b.localeCompare(a)); // Sorts descending to get the latest
        
        if (files.length > 0) {
            return `/api/media/recordings/${cameraId}/${files[0]}`;
        }
        return null;
    } catch (error) {
        // This will happen if the directory doesn't exist, which is fine.
  return null;
    }
}

export default async function HomePage() {
  const camerasWithThumbnails = await Promise.all(CAMERAS.map(async cam => ({
     ...cam,
     thumbnailUrl: await getLatestThumbnail(cam.id)
  })));

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-16">
        <header className="text-center mb-12">
            <h1 className="text-5xl font-bold tracking-tighter text-foreground">Câmeras</h1>
            <p className="text-muted-foreground mt-2">Selecione uma câmera para ver a transmissão ao vivo ou a biblioteca.</p>
        </header>
        <main>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {camerasWithThumbnails.map((camera) => (
            <CameraCard key={camera.id} camera={camera} />
          ))}
        </div>
        </main>
      </div>
    </div>
  );
}
