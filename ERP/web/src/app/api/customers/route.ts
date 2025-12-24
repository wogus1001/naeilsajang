import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const dataFilePath = path.join(process.cwd(), 'src/data/customers.json');

export async function GET(request: Request) {
    try {
        const data = await fs.readFile(dataFilePath, 'utf8');
        const customers = JSON.parse(data);

        // Simple search filtering if needed via query params
        const { searchParams } = new URL(request.url);

        // Filter by Company Name (Strict Segregation)
        const company = searchParams.get('company');
        let filtered = customers;

        if (company) {
            filtered = filtered.filter((c: any) => c.companyName === company);
        }

        const name = searchParams.get('name');
        if (name) {
            filtered = filtered.filter((c: any) => c.name.includes(name));
        }

        if (searchParams.has('id')) {
            const id = searchParams.get('id');
            const customer = customers.find((c: any) => c.id === id);
            if (!customer) {
                return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
            }
            return NextResponse.json(customer);
        }

        // Sort by ID descending (newest first) usually, or createdAt
        // For now, return as is
        return NextResponse.json(filtered);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }
}

const scheduleFilePath = path.join(process.cwd(), 'src/data/schedules.json');

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const data = await fs.readFile(dataFilePath, 'utf8');
        const customers = JSON.parse(data);

        const newCustomer = {
            ...body,
            id: String(Date.now()), // Simple ID generation
            createdAt: new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString().split('T')[0],
            // Ensure companyName is saved (should be passed in body)
            companyName: body.companyName || ''
        };

        customers.unshift(newCustomer); // Add to top
        await fs.writeFile(dataFilePath, JSON.stringify(customers, null, 2));

        // Create Schedule Entry for New Customer
        try {
            let schedules = [];
            try {
                const scheduleData = await fs.readFile(scheduleFilePath, 'utf8');
                schedules = JSON.parse(scheduleData);
            } catch (e) {
                schedules = [];
            }

            const newSchedule = {
                id: String(Date.now() + 1), // Avoid ID collision with customer
                title: `[고객등록] ${newCustomer.name}`, // Format: [Type] Name
                date: newCustomer.createdAt,
                scope: 'work',
                status: 'progress',
                type: 'work',
                color: '#51cf66', // Green for Customer
                details: '신규 고객 등록',
                customerId: newCustomer.id,
                userId: newCustomer.managerId,
                companyName: newCustomer.companyName,
                createdAt: new Date().toISOString()
            };

            schedules.push(newSchedule);
            await fs.writeFile(scheduleFilePath, JSON.stringify(schedules, null, 2));
        } catch (scheduleError) {
            console.error('Failed to create schedule entry:', scheduleError);
            // Don't fail the customer creation if schedule fails, but maybe log it
        }

        return NextResponse.json(newCustomer);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const data = await fs.readFile(dataFilePath, 'utf8');
        let customers = JSON.parse(data);

        const index = customers.findIndex((c: any) => c.id === body.id);
        if (index === -1) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        customers[index] = { ...customers[index], ...body, updatedAt: new Date().toISOString().split('T')[0] };
        await fs.writeFile(dataFilePath, JSON.stringify(customers, null, 2));

        return NextResponse.json(customers[index]);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const data = await fs.readFile(dataFilePath, 'utf8');
        let customers = JSON.parse(data);
        const newCustomers = customers.filter((c: any) => c.id !== id);

        await fs.writeFile(dataFilePath, JSON.stringify(newCustomers, null, 2));
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
    }
}
