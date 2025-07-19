'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Camera, CAMERAS } from '../cameras.config';
import LiveStream from '@/components/LiveStream';
import CameraCard from "@/components/CameraCard";
import { IconPower } from '@tabler/icons-react';

export default function HomePage() {
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [message, setMessage] = useState('');
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);

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

  const handleCleanup = async () => {
    if (!confirm('Are you sure you want to delete all recordings older than 24 hours? This cannot be undone.')) {
      return;
    }
    setIsCleaning(true);
    setCleanupResult(null);
    try {
      const response = await fetch('/api/recordings/cleanup', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setCleanupResult(`Cleanup complete! Deleted ${data.deletedFiles} files and ${data.deletedEvents} events.`);
      } else {
        throw new Error(data.error || 'Failed to clean up recordings.');
      }
    } catch (error: any) {
      setCleanupResult(`Error: ${error.message}`);
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="bg-black min-h-screen text-white">
      <div className="container mx-auto px-4 py-16">
        <header className="text-center mb-12 relative">
            <h1 className="text-5xl font-bold tracking-tighter">Câmeras</h1>
            <p className="text-neutral-400 mt-2">Selecione uma câmera para ver a transmissão ao vivo ou a biblioteca.</p>
            <div className="absolute top-0 right-0 flex flex-col items-end gap-2">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleCleanup}
                  disabled={isCleaning}
                  className="flex items-center gap-2 rounded-lg bg-yellow-900/50 px-4 py-2 text-yellow-300
                             hover:bg-yellow-800/50 hover:text-yellow-200 transition-all duration-300
                             disabled:opacity-50 disabled:cursor-wait"
                >
                  {isCleaning ? 'Cleaning...' : 'Clean Up Old Recordings'}
                </button>
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
              </div>
              {message && <p className="text-sm text-neutral-500 text-right">{message}</p>}
              {cleanupResult && (
                <p className={`text-sm text-right ${cleanupResult.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
                  {cleanupResult}
                </p>
              )}
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
