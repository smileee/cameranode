import { CAMERAS } from "@/cameras.config";
import CameraCard from "@/components/CameraCard";
import fs from 'fs/promises';
import path from 'path';

async function getThumbnail(cameraId:string){
  const screenshotsDir = path.join(process.cwd(),'screenshots',cameraId);
  const recordingsDir = path.join(process.cwd(),'recordings',cameraId);
  const readDir=async(dir:string)=>{try{return (await fs.readdir(dir)).filter(f=>f.endsWith('.jpg')).sort().reverse();}catch(e){return [];}};
  let files = await readDir(screenshotsDir);
  if(files.length>0) return `/api/media/${cameraId}/screenshots/${files[0]}`;
  files = await readDir(recordingsDir);
  if(files.length>0) return `/api/media/${cameraId}/recordings/${files[0]}`;
  return null;
}

export default async function HomePage() {
  const camerasWithThumb = await Promise.all(CAMERAS.map(async cam=>({
     ...cam,
     thumb: await getThumbnail(cam.id)
  })));
  return (
    <main className="min-h-screen w-full bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-center">Câmeras</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {camerasWithThumb.map((camera) => (
            <CameraCard key={camera.id} camera={camera} />
          ))}
        </div>
      </div>
    </main>
  );
}
