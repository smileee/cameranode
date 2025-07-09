import { NextRequest, NextResponse } from 'next/server';

/**
 * A simplified webhook handler for debugging purposes.
 * It logs a message and returns a success response immediately.
 */
export async function POST(req: NextRequest) {
    console.log('--- [DEBUG] WEBHOOK RECEIVED ---');
    console.log(`Request URL: ${req.url}`);
    console.log(`Request Method: ${req.method}`);
    
    // Log all headers
    const headers = Object.fromEntries(req.headers);
    console.log('Request Headers:', JSON.stringify(headers, null, 2));

    try {
        const rawBody = await req.text();
        console.log(`Received Body: ${rawBody || '[EMPTY]'}`);
    } catch (e) {
        console.log('Error reading body:', e);
    }
    
    return NextResponse.json({ status: 'received' }, { status: 200 });
}
