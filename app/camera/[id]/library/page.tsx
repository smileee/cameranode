import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CAMERAS } from '@/cameras.config';
import LibraryClient from './client';

export default async function LibraryPage({ params }: { params: { id:string } }) {
    const camera = CAMERAS.find(c => c.id === params.id);

    if (!camera) {
        notFound();
    }

    return (
        <main className="min-h-screen w-full bg-black text-white">
            <div className="container mx-auto px-4 py-8">
                <div className="mb-6">
                    <Link href={`/camera/${camera.id}`} className="text-gray-400 hover:text-gray-300">
                        &larr; Voltar para a Câmera
                    </Link>
                </div>
                <h1 className="text-4xl font-bold mb-8">Biblioteca da {camera.name}</h1>
                
                <LibraryClient 
                    cameraId={camera.id}
                />

            </div>
        </main>
    );
} 