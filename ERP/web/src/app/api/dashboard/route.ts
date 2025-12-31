import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Helper to read JSON file safely
const readJsonFile = (filename: string) => {
    const filePath = path.join(process.cwd(), 'src/data', filename);
    if (!fs.existsSync(filePath)) return [];
    try {
        const fileData = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(fileData);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error);
        return [];
    }
};

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // 1. Load Data
        const schedules = readJsonFile('schedules.json');
        const contracts = readJsonFile('contracts.json'); // Using contracts.json for list/count
        const properties = readJsonFile('properties.json');
        const customers = readJsonFile('customers.json');

        // 2. Load User Info & Permissions
        const users = readJsonFile('users.json');
        const currentUser = users.find((u: any) => u.id === userId);
        const userCompany = currentUser?.companyName || '';
        const isAdmin = currentUser?.role === 'admin' || userId === 'admin';

        // 3. Filter & Aggregate Data for User

        // A. Schedules (Today + Upcoming)
        // Use KST for date comparison
        const now = new Date();
        const kstOffset = 9 * 60; // KST is UTC+9
        const kstDate = new Date(now.getTime() + (kstOffset * 60 * 1000));
        const todayStr = kstDate.toISOString().split('T')[0];
        console.log('[Dashboard API] Debug:', { todayStr, userId, totalSchedules: schedules.length });

        const userSchedules = schedules.filter((s: any) => {
            // Include personal schedules
            if (s.userId === userId) return true;
            // Include company shared schedules
            if (userCompany && s.companyName === userCompany && (s.scope === 'public' || s.scope === 'work')) {
                return true;
            }
            return false;
        });

        const upcomingSchedules = userSchedules.filter((s: any) =>
            s.date >= todayStr &&
            !['completed', 'canceled', 'postponed'].includes(s.type) &&
            !['completed', 'canceled', 'postponed'].includes(s.status)
        );
        console.log('[Dashboard API] Filtered:', { userSchedules: userSchedules.length, upcoming: upcomingSchedules.length });

        // Sort by date ASC, then time ASC
        const sortedSchedules = upcomingSchedules
            .sort((a: any, b: any) => {
                if (a.date !== b.date) return a.date.localeCompare(b.date);
                return (a.time || '').localeCompare(b.time || '');
            })
            .slice(0, 5); // Start with top 5

        // B. Contracts (Ongoing & Recent) - Filter by company (same as list page)
        const companyContracts = contracts.filter((c: any) => {
            if (isAdmin) return true;
            const targetUser = users.find((u: any) => u.id === c.userId);
            return (userCompany && targetUser?.companyName === userCompany) || c.userId === userId;
        });

        // 1. Project-based contracts (from contracts.json)
        const projectOngoingContracts = companyContracts.filter((c: any) =>
            ['on_going', 'active', 'progress', 'WAITING', 'APPROVAL_REQUESTED'].includes(c.status)
        );

        // 2. E-signature contracts (Aggregated from UCanSign API)
        let electronicOngoingCount = 0;
        let apiRecentContracts: any[] = [];
        try {
            const { getContracts } = await import('@/lib/ucansign/client');
            const apiContracts = await getContracts(userId) || [];
            const ongoingMerged = apiContracts.filter((c: any) => {
                const status = (c.status || '').toLowerCase();
                return !['completed', 'canceled', 'rejected', 'trash', 'expired', 'deleted'].includes(status);
            });
            electronicOngoingCount = ongoingMerged.length;

            apiRecentContracts = apiContracts.slice(0, 10).map((c: any) => ({
                id: String(c.documentId || c.id),
                title: c.title || c.name || '전자계약',
                customer: c.receiverName || '고객',
                status: c.status,
                date: (c.createdAt || '').split('T')[0],
                type: '전자계약'
            }));
        } catch (error) {
            console.error('Failed to fetch electronic contracts:', error);
        }

        // Local contracts (contracts.json) - Treat as Electronic Contracts if they have ucansignId
        // Also include Project contracts (those without ucansignId)
        const localContracts = companyContracts
            .slice()
            .reverse()
            .slice(0, 20)
            .map((c: any) => ({
                id: String(c.id),
                title: c.name || c.title || '계약 내역',
                customer: c.customerName || '고객',
                status: c.status,
                date: (c.createdAt || '').split('T')[0],
                // If it has ucansignId, it's electronic. Otherwise it's manually created project.
                type: c.ucansignId ? '전자계약' : '프로젝트'
            }));

        // Merge and Deduplicate
        // 1. Electronic from Local (only if not present in API)
        const apiIds = new Set(apiRecentContracts.map(c => c.id));
        const localElectronic = localContracts.filter((c: any) => c.type === '전자계약' && !apiIds.has(c.id));

        // 2. Project from Local (include 'active', 'on_going', 'completed', etc.)
        const localProjects = localContracts.filter((c: any) => c.type === '프로젝트');

        const mergedRecent = [...apiRecentContracts, ...localElectronic, ...localProjects]
            .filter(c => c.date)
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 5);

        // C. Properties (New this month)
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-indexed

        const userProperties = properties.filter((p: any) => {
            // Admin sees all properties to match properties/page.tsx
            if (isAdmin) return true;
            if (userCompany) return p.companyName === userCompany;
            return p.userId === userId || p.managerId === userId;
        });

        const newPropertiesCount = userProperties.filter((p: any) => {
            if (!p.createdAt) return false;
            const d = new Date(p.createdAt);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        }).length;

        // D. Customers (Total) - Also filter by company to match customers/page.tsx
        const companyCustomers = customers.filter((c: any) => {
            if (userCompany) return c.companyName === userCompany;
            return c.userId === userId || c.managerId === userId;
        });

        // Calculate D+2 date for Stats Count
        const dPlus2Date = new Date(kstDate);
        dPlus2Date.setDate(dPlus2Date.getDate() + 2);
        const dPlus2Str = dPlus2Date.toISOString().split('T')[0];

        const shortTermCount = upcomingSchedules.filter((s: any) => s.date <= dPlus2Str).length;

        // 3. Construct Response
        const dashboardData = {
            stats: {
                scheduleCount: shortTermCount,
                ongoingContractCount: projectOngoingContracts.length + electronicOngoingCount,
                projectContractCount: projectOngoingContracts.length,
                apiContractCount: electronicOngoingCount,
                newPropertyCount: newPropertiesCount,
                totalCustomerCount: companyCustomers.length,
            },
            todaySchedules: sortedSchedules.map((s: any) => ({
                id: s.id,
                time: `${s.date.slice(5)} ${s.time || ''}`, // Show MM-DD Time for upcoming
                title: s.title,
                location: s.location || '',
                type: s.type || 'schedule'
            })),
            recentContracts: mergedRecent
        };

        return NextResponse.json(dashboardData);

    } catch (error) {
        console.error('Dashboard API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
