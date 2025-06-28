'use client';

import { useState } from 'react';
import Image from 'next/image';

interface MediaItem {
    thumbnail: string; // path relative to /api/media/{cameraId}/
    video: string | null; // path relative to /api/media/{cameraId}/
}

interface LibraryClientProps {
    cameraId: string;
    items: MediaItem[];
}

export default function LibraryClient({ cameraId, items }: LibraryClientProps) {
    const [modalVideoUrl, setModalVideoUrl] = useState<string | null>(null);
    const mediaBaseUrl = `/api/media/${cameraId}`;

    return (
        <>
            <section>
                <h2 className="text-2xl font-semibold mb-4 border-b border-gray-900 pb-2">Mídia Recente</h2>
                {items.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {items.map(item => {
                            const thumbnailUrl = `${mediaBaseUrl}/${item.thumbnail}`;
                            const fileName = item.thumbnail.split('/').pop() || '';
                            
                            // It's a video if the video property is not null
                            if (item.video) {
                                const videoUrl = `${mediaBaseUrl}/${item.video}`;
                                return (
                                    <div key={item.thumbnail} className="group relative bg-gray-800 rounded-lg overflow-hidden shadow-lg cursor-pointer" onClick={() => setModalVideoUrl(videoUrl)}>
                                        <Image
                                            src={thumbnailUrl}
                                            alt={`Thumbnail for ${fileName}`}
                                            width={400}
                                            height={225}
                                            className="w-full h-auto object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path></svg>
                                        </div>
                                        <p className="text-xs text-gray-400 p-2 truncate">{fileName.replace('.jpg', '.mp4')}</p>
                                    </div>
                                );
                            } 
                            
                            // Otherwise, it's a screenshot
                            else {
                                return (
                                     <div key={item.thumbnail} className="group relative bg-gray-800 rounded-lg overflow-hidden shadow-lg">
                                        <a href={thumbnailUrl} target="_blank" rel="noopener noreferrer">
                                            <Image
                                                src={thumbnailUrl}
                                                alt={`Screenshot ${fileName}`}
                                                width={400}
                                                height={225}
                                                className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-300"
                                            />
                                        </a>
                                        <p className="text-xs text-gray-400 p-2 truncate">{fileName}</p>
                                    </div>
                                );
                            }
                        })}
                    </div>
                ) : (
                    <p className="text-gray-400">Nenhuma mídia encontrada.</p>
                )}
            </section>
            
            {modalVideoUrl && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50" onClick={() => setModalVideoUrl(null)}>
                    <div className="relative w-full max-w-4xl" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setModalVideoUrl(null)} className="absolute -top-10 right-0 text-white text-3xl font-bold">&times;</button>
                        <video className="w-full h-auto" src={modalVideoUrl} controls autoPlay>
                            Seu navegador não suporta a tag de vídeo.
                        </video>
                    </div>
                </div>
            )}
        </>
    );
} 