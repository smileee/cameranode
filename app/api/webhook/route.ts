import { NextResponse } from 'next/server';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';

// Define the shape of our data
interface WebhookEntry {
  receivedAt: string;
  payload: any;
}

interface Data {
  webhooks: WebhookEntry[];
}

// Configure the LowDB instance
const file = path.join(process.cwd(), 'db.json');
const adapter = new JSONFile<Data>(file);
const db = new Low<Data>(adapter, { webhooks: [] });

// NOTE: For production you should move these to environment variables.
const SMS_API_URL = 'https://gateway-pool.sendeasy.pro/bulk-sms';
const SMS_TOKEN = process.env.SMS_API_TOKEN || '08164ddd-61aa-4c7b-8faa-e24ba7e3bfe0';
const DESTINATION_NUMBER = process.env.SMS_DESTINATION || '+17743010298';
const ALERT_MESSAGE = process.env.SMS_ALERT_MESSAGE || 'CHECK FOR DUCKS';

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    // Read data from DB
    await db.read();
    db.data ||= { webhooks: [] }; // Ensure db.data is not null

    // Save the incoming webhook to the database
    db.data.webhooks.push({
      receivedAt: new Date().toISOString(),
      payload: payload,
    });
    
    // Write to file
    await db.write();

    // Basic validation
    // if (!Array.isArray(payload?.detections)) {
    //   return NextResponse.json({ error: 'Invalid payload: missing detections array' }, { status: 400 });
    // }

    // Check if any detected object is a bird (case-insensitive, singular/plural)
    const hasBird = payload.detections.some((d: any) => {
      const obj = String(d?.object || '').toLowerCase();
      return obj.includes('bird');
    });

    if (hasBird) {
      // Fire off SMS alert
      try {
        const smsRes = await fetch(SMS_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': SMS_TOKEN,
            Authorization: `Bearer ${SMS_TOKEN}`,
          },
          body: JSON.stringify({
            messages: [
              {
                number: DESTINATION_NUMBER,
                message: ALERT_MESSAGE,
              },
            ],
          }),
        });

        if (!smsRes.ok) {
          const text = await smsRes.text();
          console.error('SMS gateway error:', smsRes.status, text);
          return NextResponse.json(
            { error: 'Failed to send SMS', details: text },
            { status: 502 }
          );
        }

        return NextResponse.json({ status: 'bird detected, SMS sent' });
      } catch (smsErr) {
        console.error('SMS request failed:', smsErr);
        return NextResponse.json({ error: 'SMS request failed' }, { status: 502 });
      }
    }

    // No birds detected, no SMS sent
    return NextResponse.json({ status: 'no bird detected' });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return NextResponse.json({ error: 'Invalid JSON or server error' }, { status: 400 });
  }
} 