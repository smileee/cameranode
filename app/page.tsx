'use client';

import Link from 'next/link';
import { CAMERAS } from '../cameras.config';
import CameraCard from "@/components/CameraCard";
import { IconSettings } from '@tabler/icons-react';

export default function HomePage() {
  return (
    <div className="bg-black min-h-screen text-white">
      <div className="container mx-auto px-4 py-16">
        <header className="text-center mb-12 relative">
            <h1 className="text-5xl font-bold tracking-tighter">Câmeras</h1>
            <p className="text-neutral-400 mt-2">Selecione uma câmera para ver a transmissão ao vivo ou a biblioteca.</p>
            <div className="absolute top-0 right-0 flex flex-col items-end gap-2">
              <Link href="/settings" className="flex items-center gap-2 rounded-lg bg-gray-800/50 px-4 py-2 text-gray-300 hover:bg-gray-700/50 hover:text-gray-200 transition-all duration-300">
                  <IconSettings size={18} />
                  <span>Settings</span>
              </Link>
            </div>
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
