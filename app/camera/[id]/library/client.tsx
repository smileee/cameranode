'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { IconStar, IconDownload, IconInfoCircle, IconStarFilled, IconPlayerPlayFilled } from '@tabler/icons-react';

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
                <Link href={`${pathname}?page=${currentPage - 1}`} 
                      className={`btn btn-ghost ${currentPage <= 1 ? 'opacity-50 pointer-events-none' : ''}`}>
                    &larr; Anterior
                </Link>
                
                <span className="text-muted-foreground">
                    Página {currentPage} de {totalPages}
                </span>

                <Link href={`${pathname}?page=${currentPage + 1}`} 
                      className={`btn btn-ghost ${currentPage >= totalPages ? 'opacity-50 pointer-events-none' : ''}`}>
                    Próxima &rarr;
                </Link>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                        {items.map(item => {
                        const thumbnailUrl = `/api/media/${item.thumbnail}`;
                        const mediaUrl = `/api/media/${item.id}`;
                        
                        const friendlyName = (
                            item.events[0]?.label || 
                            (item.events[0]?.type ? item.events[0].type.replace(/_/g, ' ') : null) || 
                            'Recording'
                        );

                        const renderMedia = () => (
                            <div className="group relative bg-neutral-900 rounded-lg overflow-hidden shadow-lg border border-neutral-800 hover:border-neutral-700 transition-colors duration-200 flex flex-col">
                                <div className="relative cursor-pointer" onClick={() => item.video && setModalVideoUrl(mediaUrl)}>
                                        <Image
                                            src={thumbnailUrl}
                                        alt={`Thumbnail for ${item.fileName}`}
                                            width={400}
                                            height={225}
                                        className="w-full h-auto object-cover aspect-video"
                                        unoptimized
                                    />
                                    
                                    {item.events && item.events.length > 0 && (
                                        <span className="absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full border bg-white text-black border-black">
                                            {(item.events[0].label || (item.events[0].type.startsWith('audio') ? 'AUDIO' : 'MOTION')).toUpperCase()}
                                        </span>
                                    )}
                                    
                                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                                        <h3 className="text-white font-semibold capitalize truncate">{friendlyName}</h3>
                                        <p className="text-sm text-neutral-400">{item.formattedDate}</p>
                                    </div>

                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                        {item.video && (
                                            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-white drop-shadow-lg">
                                                <IconPlayerPlayFilled size={32} className="text-black" />
                                            </div>
                                        )}
                                        <div className="absolute bottom-3 right-3 flex items-center space-x-2">
                                            <button title="Info" className="p-2 rounded-full bg-black/50 hover:bg-white/20 text-white transition-colors" onClick={(e) => { e.stopPropagation(); setInfoModalData({fileName:item.fileName,events:item.events})}}>
                                                <IconInfoCircle size={20} />
                                            </button>
                                            <button 
                                                title={item.isFavorite ? "Unfavorite" : "Favorite"} 
                                                className="p-2 rounded-full bg-black/50 hover:bg-white/20 text-white transition-colors"
                                                onClick={(e) => { e.stopPropagation(); handleFavoriteToggle(item.id, item.isFavorite); }}
                                            >
                                                {item.isFavorite ? <IconStarFilled size={20} className="text-yellow-400" /> : <IconStar size={20} />}
                                            </button>
                                            <a href={mediaUrl} download title="Download" className="p-2 rounded-full bg-black/50 hover:bg-white/20 text-white transition-colors" onClick={(e) => e.stopPropagation()}>
                                                <IconDownload size={20} />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                                    </div>
                                );

                        return item.video 
                            ? <div key={item.thumbnail}>{renderMedia()}</div>
                            : <a key={item.thumbnail} href={thumbnailUrl} target="_blank" rel="noopener noreferrer">{renderMedia()}</a>;
                        })}
                    </div>
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
                    <div className="bg-neutral-800 rounded-lg p-6 max-w-sm w-full text-white border border-neutral-700" onClick={e=>e.stopPropagation()}>
                        <h3 className="text-lg font-semibold mb-2">Informações do Arquivo</h3>
                        <p className="break-all text-sm mb-4 text-neutral-300 font-mono">{infoModalData.fileName}</p>
                        {infoModalData.events.length>0 && (
                            <div>
                                <p className="text-sm font-semibold mb-1 text-white">Eventos Detectados:</p>
                                <ul className="list-disc list-inside text-sm text-neutral-300">
                                    {infoModalData.events.map((ev,idx)=>(
                                       <li key={idx} className="capitalize">{ev.type.replace(/_/g, ' ')}{ev.label?`: ${ev.label}`:''}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <button className="mt-6 w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded transition-colors" onClick={()=>setInfoModalData(null)}>Fechar</button>
                    </div>
                </div>
            )}
        </>
    );
} 