import { CAMERAS } from "@/cameras.config";
import CameraCard from "@/components/CameraCard";

export default async function HomePage() {
  return (
    <div className="bg-black min-h-screen text-white">
      <div className="container mx-auto px-4 py-16">
        <header className="text-center mb-12">
            <h1 className="text-5xl font-bold tracking-tighter">Câmeras</h1>
            <p className="text-neutral-400 mt-2">Selecione uma câmera para ver a transmissão ao vivo ou a biblioteca.</p>
        </header>
        <main>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {CAMERAS.map((camera) => (
                <CameraCard key={camera.id} camera={camera} />
              ))}
            </div>
        </main>
      </div>
    </div>
  );
}
