'use client';

import Link from 'next/link';
import { CAMERAS } from '../cameras.config';
import CameraCard from "@/components/CameraCard";
import { IconSettings } from '@tabler/icons-react';

export default function HomePage() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-12">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Cameras</h1>
              <p className="text-muted-foreground mt-1">Select a camera to view the live stream or library.</p>
            </div>
            <Link href="/settings" className="btn btn-ghost">
                <IconSettings size={18} />
                <span className="ml-2">Settings</span>
            </Link>
        </header>
        <main>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {CAMERAS.map((camera) => (
                <CameraCard key={camera.id} camera={camera} />
              ))}
            </div>
        </main>
      </div>
    </div>
  );
}
