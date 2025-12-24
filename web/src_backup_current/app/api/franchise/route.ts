import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query) {
        return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    try {
        // Read from local cache instead of external API
        const filePath = path.join(process.cwd(), 'src/data/franchises.json');

        if (!fs.existsSync(filePath)) {
            console.error('Franchise data file not found');
            return NextResponse.json([], { status: 200 }); // Return empty if file doesn't exist
        }

        const fileContent = fs.readFileSync(filePath, 'utf8');
        const items = JSON.parse(fileContent);

        // Filter by query (case-insensitive, robust)
        const normalizedQuery = query.toLowerCase().trim();
        const filteredItems = items.filter((item: any) => item.brandNm.toLowerCase().includes(normalizedQuery));

        return NextResponse.json(filteredItems);

    } catch (error) {
        console.error('Error fetching franchise data:', error);
        return NextResponse.json({ error: 'Failed to fetch franchise data' }, { status: 500 });
    }
}
