'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { IconStar, IconDownload, IconInfoCircle, IconStarFilled, IconBell } from '@tabler/icons-react';

interface Event {
    type: string;
    label?: string;
}

interface MediaItem {
    id: string;
    thumbnail: string;
    video: string | null;
    isFavorite: boolean;
    formattedDate: string;
    fileName: string;
    events: Event[];
}

interface LibraryClientProps {
    cameraId: string;
}

export default function LibraryClient({ cameraId }: LibraryClientProps) {
    const [items, setItems] = useState<MediaItem[]>([]);
    const [totalPages, setTotalPages] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalVideoUrl, setModalVideoUrl] = useState<string | null>(null);
    const [infoModalData, setInfoModalData] = useState<{fileName:string; events:Event[]}|null>(null);
    
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const currentPage = parseInt(searchParams.get('page') || '1', 10);

    const fetchMedia = useCallback(async (page: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/media/${cameraId}?page=${page}&limit=8`);
            if (!response.ok) {
                throw new Error('Failed to fetch media');
            }
            const data = await response.json();
            setItems(data.mediaItems);
            setTotalPages(data.totalPages);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [cameraId]);

    useEffect(() => {
        fetchMedia(currentPage);
    }, [currentPage, fetchMedia]);

    const handleFavoriteToggle = async (filePath: string, currentStatus: boolean) => {
        // Optimistic update
        setItems(currentItems =>
            currentItems.map(item =>
                item.id === filePath ? { ...item, isFavorite: !currentStatus } : item
            )
        );

        try {
            await fetch('/api/media/favorite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath, isFavorite: !currentStatus }),
            });
            // No need to refresh, UI is already updated.
            // You might want to re-fetch to ensure consistency, but for now this is faster.
        } catch (error) {
            console.error("Failed to update favorite status:", error);
            // Revert on error
            setItems(currentItems =>
                currentItems.map(item =>
                    item.id === filePath ? { ...item, isFavorite: currentStatus } : item
                )
            );
        }
    };
    
    const PaginationControls = () => {
        if (totalPages <= 1) return null;
        
        return (
            <div className="flex justify-center items-center space-x-4 mt-8">
                {currentPage > 1 && (
                    <Link href={`${pathname}?page=${currentPage - 1}`} className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors">
                        &larr; Anterior
                    </Link>
                )}
                
                <span className="text-gray-400">
                    Página {currentPage} de {totalPages}
                </span>

                {currentPage < totalPages && (
                     <Link href={`${pathname}?page=${currentPage + 1}`} className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors">
                        Próxima &rarr;
                    </Link>
                )}
            </div>
        );
    };

    if (isLoading) {
        return <div className="text-center p-8">Carregando mídia...</div>;
    }

    if (error) {
        return <div className="text-center p-8 text-red-500">Erro ao carregar: {error}</div>;
    }

    return (
        <>
            <section>
                <h2 className="text-2xl font-semibold mb-4 border-b border-gray-900 pb-2">Mídia Recente</h2>
                {items.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-6">
                        {items.map(item => {
                            const thumbnailUrl = `/api/media/${item.thumbnail}`;
                            const mediaUrl = `/api/media/${item.id}`;
                            
                            const friendlyName = (() => {
                                // Strip prefix and extension for readability
                                let base = item.fileName.replace(/^webhook-rec-/, '').replace(/\.jpg$|\.mp4$/,'');
                                return base.replace(/-/g, ' ');
                            })();

                            const renderMedia = () => (
                                <div className="group relative bg-gray-800 rounded-lg overflow-hidden shadow-lg h-full flex flex-col">
                                    <div className="relative cursor-pointer" onClick={() => item.video && setModalVideoUrl(mediaUrl)}>
                                        <Image
                                            src={thumbnailUrl}
                                            alt={`Thumbnail for ${item.fileName}`}
                                            width={400}
                                            height={225}
                                            className="w-full h-auto object-cover aspect-video"
                                            unoptimized // Since they are served locally
                                        />
                                        {item.video && (
                                            <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path></svg>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3 flex flex-col flex-grow">
                                        <p className="text-xs text-gray-400 truncate" title={item.fileName}>{friendlyName}</p>
                                        <p className="text-xs text-gray-500 mt-1 flex-grow">{item.formattedDate}</p>
                                        <div className="flex items-center justify-end space-x-2 mt-2 text-gray-400">
                                            {item.events && item.events.length > 0 && (
                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${item.events[0].type.startsWith('audio') ? 'bg-green-600' : 'bg-blue-600'}`}
                                                >{item.events[0].type.startsWith('audio') ? 'AUDIO' : 'MOTION'}</span>
                                            )}
                                            <button title="Info" className="hover:text-white transition-colors" onClick={()=>setInfoModalData({fileName:item.fileName,events:item.events})}>
                                                <IconInfoCircle size={20} />
                                            </button>
                                            <button 
                                                title={item.isFavorite ? "Unfavorite" : "Favorite"} 
                                                className="hover:text-white transition-colors"
                                                onClick={() => handleFavoriteToggle(item.id, item.isFavorite)}
                                            >
                                                {item.isFavorite ? <IconStarFilled size={20} className="text-yellow-500" /> : <IconStar size={20} />}
                                            </button>
                                            <a href={mediaUrl} download title="Download" className="hover:text-white transition-colors">
                                                <IconDownload size={20} />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            );

                            return item.video 
                                ? <div key={item.thumbnail}>{renderMedia()}</div>
                                : <a key={item.thumbnail} href={thumbnailUrl} target="_blank" rel="noopener noreferrer">{renderMedia()}</a>;
                        })}
                    </div>
                ) : (
                    <p className="text-gray-400">Nenhuma mídia encontrada.</p>
                )}
                 <PaginationControls />
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

            {infoModalData && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50" onClick={()=>setInfoModalData(null)}>
                    <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full text-white" onClick={e=>e.stopPropagation()}>
                        <h3 className="text-lg font-semibold mb-2">Informações do Arquivo</h3>
                        <p className="break-all text-sm mb-4">{infoModalData.fileName}</p>
                        {infoModalData.events.length>0 && (
                            <div>
                                <p className="text-sm font-semibold mb-1">Eventos:</p>
                                <ul className="list-disc list-inside text-sm">
                                    {infoModalData.events.map((ev,idx)=>(
                                       <li key={idx}>{ev.type}{ev.label?`: ${ev.label}`:''}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <button className="mt-4 bg-blue-600 hover:bg-blue-500 text-white px-4 py-1 rounded" onClick={()=>setInfoModalData(null)}>Fechar</button>
                    </div>
                </div>
            )}
        </>
    );
} 