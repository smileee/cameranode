'use client';

import { useState } from 'react';
import LiveStream from '@/components/LiveStream';
import { Camera } from '@/cameras.config';
import Link from 'next/link';

export default function CameraClientPage({ camera }: { camera: Camera }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTogglingRecording, setIsTogglingRecording] = useState(false);
  const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);

  const streamUrl = `ws://localhost:8082/${camera.id}`;

  const handleScreenshot = async () => {
    setIsTakingScreenshot(true);
    try {
      const response = await fetch(`/api/camera/${camera.id}/screenshot`, {
        method: 'POST',
      });
      const result = await response.json();
      if (response.ok) {
        alert('Screenshot salvo com sucesso!');
      } else {
        alert(`Erro ao tirar screenshot: ${result.error}`);
      }
    } catch (error) {
      console.error('Error taking screenshot:', error);
      alert('Ocorreu um erro de rede ao tirar o screenshot.');
    } finally {
      setIsTakingScreenshot(false);
    }
  };

  const handleToggleRecording = async () => {
    setIsTogglingRecording(true);
    const action = isRecording ? 'stop' : 'start';
    try {
        const response = await fetch(`/api/camera/${camera.id}/record`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
        });
        const result = await response.json();
        if (response.ok) {
            setIsRecording(!isRecording);
            alert(`Gravação ${action === 'start' ? 'iniciada' : 'parada'} com sucesso!`);
        } else {
            alert(`Erro: ${result.error}`);
        }
    } catch (error) {
        console.error('Error toggling recording:', error);
        alert('Ocorreu um erro de rede ao controlar a gravação.');
    } finally {
        setIsTogglingRecording(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/" className="text-gray-400 hover:text-gray-300">
            &larr; Voltar para Câmeras
          </Link>
        </div>
        <h1 className="text-4xl font-bold mb-4">{camera.name}</h1>
        <div className="aspect-video w-full max-w-4xl mx-auto bg-black rounded-lg overflow-hidden shadow-lg">
          <LiveStream streamUrl={streamUrl} />
        </div>
        <div className="mt-6 max-w-4xl mx-auto flex flex-wrap gap-4 justify-center">
          <button
            onClick={handleScreenshot}
            disabled={isTakingScreenshot || isTogglingRecording}
            className="bg-black hover:bg-gray-600/10 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTakingScreenshot ? 'Capturando...' : 'Tirar Screenshot'}
          </button>
          <button
            onClick={handleToggleRecording}
            disabled={isTogglingRecording || isTakingScreenshot}
            className={`${
              isRecording
                ? 'bg-red-700 hover:bg-red-600'
                : 'bg-gray-700 hover:bg-gray-600'
            } text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isTogglingRecording ? (isRecording ? 'Parando...' : 'Iniciando...') : (isRecording ? 'Parar Gravação' : 'Iniciar Gravação')}
          </button>
          <Link
            href={`/camera/${camera.id}/library`}
            className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            Biblioteca
          </Link>
        </div>
      </div>
    </main>
  );
} 