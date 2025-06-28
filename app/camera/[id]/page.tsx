import { notFound } from 'next/navigation';
import { CAMERAS } from '@/cameras.config';
import CameraClientPage from './client';

export default async function CameraPage({ params }: { params: { id: string } }) {
  const camera = CAMERAS.find(c => c.id === params.id);

  if (!camera) {
    notFound();
  }

  return <CameraClientPage camera={camera} />;
}
