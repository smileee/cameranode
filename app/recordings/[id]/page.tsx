import { CAMERAS, Camera } from "@/cameras.config";
import RecordingsClient from "./client";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft as IconArrowLeft } from "tabler-icons-react";

export default function RecordingsPage({ params }: { params: { id: string } }) {
  const camera = CAMERAS.find((c: Camera) => c.id === params.id);

  if (!camera) {
    notFound();
  }

  return (
    <main className="min-h-screen w-full bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
         <header className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-6 gap-4">
            <div>
                <Link 
                  href={`/camera/${camera.id}`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-2"
                >
                    <IconArrowLeft size={16} /> Back to {camera.name}
                </Link>
                <h1 className="text-3xl font-bold text-foreground">Recordings</h1>
            </div>
             <Link 
              href="/" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
                Select Different Camera
            </Link>
        </header>
        <RecordingsClient camera={camera} />
      </div>
    </main>
  );
} 