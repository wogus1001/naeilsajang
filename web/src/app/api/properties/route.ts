import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const dataFilePath = path.join(process.cwd(), 'src/data/properties.json');

// Helper to read data
function getProperties() {
    if (!fs.existsSync(dataFilePath)) {
        return [];
    }
    const fileData = fs.readFileSync(dataFilePath, 'utf8');
    try {
        return JSON.parse(fileData);
    } catch (error) {
        return [];
    }
}

// Helper to write data
function saveProperties(properties: any[]) {
    fs.writeFileSync(dataFilePath, JSON.stringify(properties, null, 2));
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const company = searchParams.get('company'); // New: company filter
    let properties = getProperties(); // Changed to let for filtering

    if (id) {
        const property = properties.find((p: any) => String(p.id) === String(id));
        if (property) {
            return NextResponse.json(property);
        } else {
            return NextResponse.json({ error: 'Property not found' }, { status: 404 });
        }
    }

    if (company) {
        // Filter by company name using loose text match if schema is not strict, 
        // OR strict match if we trust auth.
        // Assuming properties have 'authorCompany' or we check property manager's company.
        // However, property schema currently stores 'managerId' and 'managerName'.
        // It DOES NOT explicitely store 'companyName' of the owner.
        // BUT, we can assume properties created by users of Company A belong to Company A.
        // We might need to store 'companyName' on Property creation in POST.
        properties = properties.filter((p: any) => p.companyName === company);
    }

    return NextResponse.json(properties);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const properties = getProperties();

        const newProperty = {
            id: Date.now().toString(), // Simple ID generation
            ...body,
            companyName: body.companyName, // Save company name
            createdAt: new Date().toISOString(),
        };

        properties.unshift(newProperty); // Add to beginning of list
        saveProperties(properties);

        return NextResponse.json(newProperty, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create property' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const properties = getProperties();
        const index = properties.findIndex((p: any) => String(p.id) === String(id));

        if (index === -1) {
            return NextResponse.json({ error: 'Property not found' }, { status: 404 });
        }

        // Update property
        properties[index] = {
            ...properties[index],
            ...body,
            updatedAt: new Date().toISOString()
        };
        saveProperties(properties);

        return NextResponse.json(properties[index]);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update property' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const properties = getProperties();
        const filteredProperties = properties.filter((p: any) => String(p.id) !== String(id));

        if (properties.length === filteredProperties.length) {
            return NextResponse.json({ error: 'Property not found' }, { status: 404 });
        }

        saveProperties(filteredProperties);

        return NextResponse.json({ message: 'Property deleted successfully' });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete property' }, { status: 500 });
    }
}
