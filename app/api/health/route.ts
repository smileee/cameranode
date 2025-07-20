import { NextResponse } from 'next/server';
import { checkStreamHealth } from '@/server/monitor';

/**
 * API route to check the health of all camera streams
 */
export async function GET() {
    try {
        const health = await checkStreamHealth();
        
        const overallHealth = health.every(h => h.isHealthy);
        const unhealthyCount = health.filter(h => !h.isHealthy).length;
        
        return NextResponse.json({
            timestamp: new Date().toISOString(),
            overall: {
                healthy: overallHealth,
                totalCameras: health.length,
                unhealthyCount
            },
            streams: health
        });
    } catch (error) {
        console.error('[API Health] Error checking stream health:', error);
        return NextResponse.json({ 
            error: 'Failed to check stream health',
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
} 