'use client';

import { IconPlayerPlayFilled, IconPhoto } from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';
import type { Camera } from '@/cameras.config';

interface CameraWithThumb extends Camera {
  thumbnailUrl: string | null;
}

interface CameraCardProps {
  camera: CameraWithThumb;
}

export default function CameraCard({ camera }: CameraCardProps) {
  return (
    <Link href={`/camera/${camera.id}`} className="group block">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-card border border-border 
                     transition-all duration-200 group-hover:border-accent group-hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]">
        {camera.thumbnailUrl ? (
          <Image
            src={camera.thumbnailUrl}
            alt={`Thumbnail for ${camera.name}`}
            layout="fill"
            objectFit="cover"
            className="transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary">
            <span className="text-muted-foreground">Sem Sinal</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
      </div>
      <div className="mt-3">
        <h3 className="font-semibold text-foreground">{camera.name}</h3>
        <p className="text-sm text-muted-foreground">ID: {camera.id}</p>
      </div>
    </Link>
  );
}
