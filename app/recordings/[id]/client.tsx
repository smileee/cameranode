'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PlayerPlay, Download, X as IconX } from 'tabler-icons-react';
import RecordingPreview from '@/components/RecordingPreview';

type RecordingItem = {
  video: string;
  thumb: string;
  date: string;
};

type RecordingsResponse = {
  total: number;
  page: number;
  size: number;
  items: RecordingItem[];
  cameraName: string;
};

interface RecordingsClientProps {
  camera: { id: string; name: string };
}

function RecordingsDisplay({ camera }: RecordingsClientProps) {
  const [recordings, setRecordings] = useState<RecordingsResponse | null>(null);
  const [selectedRecording, setSelectedRecording] = useState<RecordingItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectionIntent, setSelectionIntent] = useState<'first' | 'last' | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const sizeParam = parseInt(searchParams.get('size') || '6',10);
  const pageSize = isNaN(sizeParam)? 6 : sizeParam;

  const selectedRecordingIndex = selectedRecording 
    ? recordings?.items.findIndex(item => item.video === selectedRecording.video) ?? -1
    : -1;

  const totalPages = recordings ? Math.ceil(recordings.total / recordings.size) : 1;
  const isLastVideo = recordings ? (selectedRecordingIndex === recordings.items.length - 1 && currentPage === totalPages) : false;
  const isFirstVideo = selectedRecordingIndex === 0 && currentPage === 1;

  useEffect(() => {
    fetch(`/api/recordings/${camera.id}?page=${currentPage}&size=${pageSize}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await res.text());
        }
        return res.json();
      })
      .then((data) => {
        setError(null);
        setRecordings(data);

        if (selectionIntent && data.items.length) {
          const target = selectionIntent === 'first' ? data.items[0] : data.items[data.items.length - 1];
          setSelectedRecording(target);
          setSelectionIntent(null);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch recordings:', err);
        setError(`Unable to load recordings for ${camera.name}. Please check the server logs.`);
      });
  }, [currentPage, camera.id, camera.name, pageSize]);

  const openModal = (recording: RecordingItem) => setSelectedRecording(recording);
  const closeModal = () => setSelectedRecording(null);

  const handleNavigation = (direction: 'next' | 'prev') => {
    if (!recordings || selectedRecordingIndex === -1) return;

    const newIndex = direction === 'next' ? selectedRecordingIndex + 1 : selectedRecordingIndex - 1;

    if (newIndex >= 0 && newIndex < recordings.items.length) {
      setSelectedRecording(recordings.items[newIndex]);
    } else {
      const nextPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
      const totalPages = Math.ceil((recordings.total || 0) / (recordings.size || 1));

      if (nextPage > 0 && nextPage <= totalPages) {
        setSelectionIntent(direction === 'next' ? 'first' : 'last');
        router.replace(`/recordings/${camera.id}?page=${nextPage}&size=${pageSize}`);
      }
    }
  };
  
  const handlePrev = () => handleNavigation('prev');
  const handleNext = () => handleNavigation('next');
  
  const formatTimestamp = (iso: string) => {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  };
  
  function handlePageChange(newPage: number) {
    if (!recordings || newPage < 1 || newPage > Math.ceil(recordings.total / recordings.size)) return;
    router.push(`/recordings/${camera.id}?page=${newPage}&size=${pageSize}`);
  }

  if (error) {
    return <p className="text-center text-red-500 py-8 font-semibold">{error}</p>;
  }

  if (!recordings) {
    return <p className="text-center text-gray-500 py-8">Loading recordings...</p>;
  }
  
  return (
    <div className="container mx-auto py-8">
      {/* <h1 className="text-3xl font-bold mb-2">Recordings for {recordings.cameraName}</h1>
      <p className="text-md text-gray-500 mb-8">
        {recordings.total} recordings found. Page {currentPage} of {Math.ceil(recordings.total / recordings.size)}.
      </p> */}

      {recordings.items.length === 0 ? (
        <p className="text-center text-gray-500 py-16">No recordings available for this camera.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {recordings.items.filter(item => item && item.video).map((item) => (
            <div 
              key={item.video} 
              className="group rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300 cursor-pointer"
              onClick={() => openModal(item)}
            >
              <div className="relative aspect-video bg-gray-100">
                <RecordingPreview 
                  thumbUrl={item.thumb} 
                  videoUrl={item.video}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <PlayerPlay size={48} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="p-4">
                <p className="font-semibold text-sm truncate" title={item.video}>{item.video}</p>
                <p className="text-xs text-gray-400">{formatTimestamp(item.date)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {recordings.total > recordings.size && (
        <div className="flex justify-center items-center gap-4 mt-12">
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                Previous
            </button>
            <span className="text-sm text-gray-300">Page {currentPage} of {Math.ceil(recordings.total / recordings.size)}</span>
            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= Math.ceil(recordings.total / recordings.size)} className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                Next
            </button>
        </div>
      )}

      {selectedRecording && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in" onClick={closeModal}>
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-4xl relative text-foreground flex flex-col gap-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 pb-0">
              <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold break-all max-w-full">{selectedRecording.video.split('/').pop()}</h2>
                    <p className="text-sm text-muted-foreground">{formatTimestamp(selectedRecording.date)}</p>
                  </div>
                  <button onClick={closeModal} className="p-1 text-gray-500 hover:text-black hover:bg-gray-100 rounded-full">
                    <IconX size={28} />
                  </button>
              </div>
            </div>
            
            <div className="px-6">
              <video
                key={selectedRecording.video}
                className="w-full h-auto max-h-[65vh] rounded-lg bg-black"
                controls
                autoPlay
                src={selectedRecording.video}
                onEnded={() => { if (!isLastVideo) handleNext() }}
              >
                Your browser does not support the video tag.
              </video>
            </div>

            <div className="flex justify-between items-center p-6 pt-2 bg-card/80 border-t border-border">
               <a href={selectedRecording.video} download className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-colors text-sm font-semibold">
                  <Download size={18} />
                  Download
               </a>
               <div className="flex gap-2">
                 <button onClick={handlePrev} disabled={isFirstVideo} className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium hover:bg-gray-800 disabled:opacity-50">Previous</button>
                 <button onClick={handleNext} disabled={isLastVideo} className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium hover:bg-gray-800 disabled:opacity-50">Next</button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default function RecordingsClient({ camera }: RecordingsClientProps) {
    return (
        <Suspense fallback={<p className="text-center text-gray-50 py-8">Loading recordings...</p>}>
            <RecordingsDisplay camera={camera} />
        </Suspense>
    );
} 