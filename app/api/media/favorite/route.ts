import { NextResponse } from "next/server";
import { setFavorite } from "@/server/db";

export async function POST(req: Request) {
    try {
        const { filePath, isFavorite } = await req.json();

        if (!filePath || typeof isFavorite !== 'boolean') {
            return NextResponse.json({ error: 'filePath and isFavorite are required' }, { status: 400 });
        }

        await setFavorite(filePath, isFavorite);
        
        return NextResponse.json({ success: true, isFavorite });

    } catch (error: any) {
        console.error('[API/Favorite] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
} 