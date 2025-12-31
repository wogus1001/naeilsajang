import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'src/data/system_settings.json');

// Helper
const getSettings = () => {
    if (!fs.existsSync(SETTINGS_FILE)) {
        return {
            announcement: { message: '', level: 'info', active: false },
            features: { electronicContracts: true, mapService: true }
        };
    }
    const fileContent = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return JSON.parse(fileContent);
};

export async function GET() {
    try {
        const settings = getSettings();
        return NextResponse.json(settings);
    } catch (error) {
        console.error('Get settings error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // Validation could go here

        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(body, null, 2), 'utf8');

        return NextResponse.json({ success: true, settings: body });
    } catch (error) {
        console.error('Save settings error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
