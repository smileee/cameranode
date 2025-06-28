import { IconPlayerPlayFilled, IconPhoto } from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';
import type { Camera } from '@/cameras.config';

interface CameraWithThumb extends Camera {
  thumb: string | null;
}

interface CameraCardProps {
  camera: CameraWithThumb;
}

export default function CameraCard({ camera }: CameraCardProps) {
  return (
    <div className="bg-gray-950 text-white rounded-lg shadow-lg overflow-hidden border border-gray-700">
      {/* Thumbnail */}
      {camera.thumb ? (
        <Image src={camera.thumb} alt={camera.name} width={400} height={225} className="w-full h-48 object-cover" />
      ) : (
        <div className="w-full h-48 bg-gray-800 flex items-center justify-center text-gray-500">Sem thumbnail</div>
      )}
      <div className="p-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold mb-1">{camera.name}</h2>
          <p className="text-xs text-gray-400">ID: {camera.id}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/camera/${camera.id}`} className="p-2 rounded bg-gray-800 hover:bg-gray-700" title="Streaming">
            <IconPlayerPlayFilled size={18} />
          </Link>
          <Link href={`/camera/${camera.id}/library`} className="p-2 rounded bg-gray-800 hover:bg-gray-700" title="Biblioteca">
            <IconPhoto size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
