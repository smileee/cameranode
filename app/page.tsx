import { CAMERAS } from '../cameras.config';
import CameraCard from '@/components/CameraCard';

export default function Home() {
  return (
    <main className="min-h-screen w-full bg-background">
      <div className="container mx-auto px-4 py-12 sm:py-16">
        <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground">Cameras</h1>
            <p className="text-muted-foreground mt-2">Select a camera to view the latest recordings.</p>
        </div>
        
        {CAMERAS.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-8">
                {CAMERAS.map((camera) => (
                    <CameraCard key={camera.id} camera={camera} />
                ))}
            </div>
        ) : (
            <div className="col-span-full text-center p-8 border border-dashed border-border rounded-lg max-w-md mx-auto">
              <h2 className="text-xl font-semibold text-foreground">No Cameras Configured</h2>
              <p className="text-muted-foreground mt-2">
                Please add a camera to the <code>cameras.config.ts</code> file to get started.
              </p>
            </div>
        )}
      </div>
    </main>
  );
}
