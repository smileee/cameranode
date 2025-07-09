'use client';

import { useState } from 'react';
import { CAMERAS } from "@/cameras.config";
import CameraCard from "@/components/CameraCard";
import { IconPower } from '@tabler/icons-react';

export default function HomePage() {
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [message, setMessage] = useState('');

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setMessage('');
    try {
      const response = await fetch('/api/camera/disconnect', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to disconnect');
      }
      setMessage('Success! All camera connections are being closed.');
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="bg-black min-h-screen text-white">
      <div className="container mx-auto px-4 py-16">
        <header className="text-center mb-12 relative">
            <h1 className="text-5xl font-bold tracking-tighter">Câmeras</h1>
            <p className="text-neutral-400 mt-2">Selecione uma câmera para ver a transmissão ao vivo ou a biblioteca.</p>
            <div className="absolute top-0 right-0">
              <button
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="flex items-center gap-2 rounded-lg bg-red-900/50 px-4 py-2 text-red-300
                           hover:bg-red-800/50 hover:text-red-200 transition-all duration-300
                           disabled:opacity-50 disabled:cursor-wait"
              >
                <IconPower size={18} />
                {isDisconnecting ? 'Disconnecting...' : 'Disconnect All'}
              </button>
              {message && <p className="text-sm text-neutral-500 mt-2 text-right">{message}</p>}
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
