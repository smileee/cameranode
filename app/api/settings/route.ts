import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

const dbPath = path.resolve(process.cwd(), 'db.json');

const settingsSchema = z.record(z.string(), z.object({
  dog: z.boolean(),
  bird: z.boolean(),
  person: z.boolean(),
}));

async function readDb() {
  try {
    const data = await fs.readFile(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { events: [], cameraSettings: {} };
    }
    throw error;
  }
}

async function writeDb(data: any) {
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function GET() {
  const db = await readDb();
  return NextResponse.json(db.cameraSettings || {});
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsedSettings = settingsSchema.parse(body);

    const db = await readDb();
    db.cameraSettings = parsedSettings;
    await writeDb(db);

    return NextResponse.json({ message: 'Settings saved successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.format() }, { status: 400 });
    }
    console.error(error as Error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 