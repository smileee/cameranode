import { notFound } from 'next/navigation';
import { CAMERAS } from '@/cameras.config';
import { getEventsForCamera } from '@/server/db';
import CameraClientPage from './client';

export default async function CameraPage({ params }: { params: { id: string } }) {
  const camera = CAMERAS.find(c => c.id === params.id);

  if (!camera) {
    notFound();
  }

  const events = await getEventsForCamera(params.id);

  return <CameraClientPage camera={camera} events={events} />;
}
