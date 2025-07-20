import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCameraSettings, saveCameraSettings } from '@/server/db';

const settingsSchema = z.record(z.string(), z.object({
  dog: z.boolean(),
  bird: z.boolean(),
  person: z.boolean(),
}));

export async function GET() {
  try {
    const settings = await getCameraSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('[API/settings] Failed to fetch settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsedSettings = settingsSchema.parse(body);

    await saveCameraSettings(parsedSettings);

    return NextResponse.json({ message: 'Settings saved successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.format() }, { status: 400 });
    }
    console.error('[API/settings] Failed to save settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
} 