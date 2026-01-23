import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();

        let companyId: string | null = null;
        let isAdmin = false;

        // Check if userId is a valid UUID
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

        if (!isUuid || userId === 'admin') {
            // Fallback for Legacy/Dev 'admin' user or invalid ID
            // Treat as Super Admin (No Company Filter)
            console.warn(`[Dashboard] Invalid UUID '${userId}'. Treating as Super Admin (All Data).`);
            companyId = null;
            isAdmin = true;
        } else {
            // 1. Get User's Company ID (Normal Flow)
            const { data: userProfile, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('company_id, role, name')
                .eq('id', userId)
                .single();

            if (profileError || !userProfile?.company_id) {
                console.error('Dashboard: User profile or company not found', profileError);
                return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
            }
            companyId = userProfile.company_id;
            isAdmin = userProfile.role === 'admin';
        }

        // 2. Parallel Data Fetching
        const now = new Date();
        const kstOffset = 9 * 60; // KST is UTC+9
        const kstDate = new Date(now.getTime() + (kstOffset * 60 * 1000));
        const todayStr = kstDate.toISOString().split('T')[0];

        const dPlus2Date = new Date(kstDate);
        dPlus2Date.setDate(dPlus2Date.getDate() + 2);
        const dPlus2Str = dPlus2Date.toISOString().split('T')[0];

        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-indexed

        // Prepare Queries
        let scheduleQuery = supabaseAdmin.from('schedules').select('*');
        let contractQuery = supabaseAdmin.from('contracts').select('*');
        let propertyQuery = supabaseAdmin.from('properties').select('id, created_at');
        let customerQuery = supabaseAdmin.from('customers').select('id', { count: 'exact', head: true });

        // Apply Company Scope only if not Admin (or if we resolved a specific company)
        // For 'admin' / invalid UUID, we treat as Super Admin (See all)
        if (companyId) {
            scheduleQuery = scheduleQuery.eq('company_id', companyId);
            contractQuery = contractQuery.eq('company_id', companyId);
            propertyQuery = propertyQuery.eq('company_id', companyId);
            customerQuery = customerQuery.eq('company_id', companyId);
        }

        const queries = [
            // A. Schedules
            scheduleQuery
                .gte('date', todayStr)
                .not('type', 'in', '("work","completed","canceled","postponed")') // Exclude work logs & finished
                .order('date', { ascending: true })
                .order('title', { ascending: true }) // fallback sort
                .limit(20),

            // B. Contracts (Project)
            contractQuery
                .order('created_at', { ascending: false }),

            // C. Properties
            propertyQuery,

            // D. Customers
            customerQuery
        ];

        const [
            { data: schedules, error: schedError },
            { data: contracts, error: contractError },
            { data: properties, error: propError },
            { count: customerCount, error: custError }
        ] = await Promise.all(queries);

        if (schedError) console.error('Error fetching schedules:', schedError);
        if (contractError) console.error('Error fetching contracts:', contractError);
        if (propError) console.error('Error fetching properties:', propError);
        if (custError) console.error('Error fetching customers:', custError);

        // 3. Process Data

        // A. Schedules
        const validSchedules = (schedules || []).filter((s: any) => {
            // Additional filtering if needed (e.g., private logic)
            // Assuming DB policy/query handles mostly correct data.
            // Check Scope if 'private' (personal)
            if (s.scope === 'personal' && s.user_id !== userId) return false;
            return true;
        });

        // Upcoming Count (Today ~ D+2)
        const shortTermCount = validSchedules.filter((s: any) => s.date <= dPlus2Str).length;

        // Top 5 for Widget
        const widgetSchedules = validSchedules.slice(0, 5).map((s: any) => ({
            id: s.id,
            time: `${s.date.slice(5)} ${s.time?.slice(0, 5) || ''}`.trim(), // MM-DD HH:mm
            title: s.title,
            location: s.location || '',
            type: s.type || 'schedule'
        }));


        // B. Contracts
        // 1. Projects (DB)
        const projectContracts = contracts || [];
        const projectOngoing = projectContracts.filter((c: any) =>
            ['on_going', 'active', 'progress', 'WAITING', 'APPROVAL_REQUESTED'].includes(c.status)
        );

        // 2. Electronic (API)
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
            // Non-blocking
        }

        // Merge Recent Contracts
        const localProjects = projectContracts.map((c: any) => ({
            id: c.id,
            title: c.name || '계약 프로젝트',
            customer: '고객', // Join with customer table if needed, or store name
            status: c.status,
            date: (c.created_at || '').split('T')[0],
            type: '프로젝트'
        }));

        const mergedRecent = [...apiRecentContracts, ...localProjects]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 5);


        // C. Properties (New This Month)
        const newPropertiesCount = (properties || []).filter((p: any) => {
            if (!p.created_at) return false;
            const d = new Date(p.created_at);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        }).length;


        // 4. Response
        const dashboardData = {
            stats: {
                scheduleCount: shortTermCount,
                ongoingContractCount: projectOngoing.length + electronicOngoingCount,
                projectContractCount: projectOngoing.length,
                apiContractCount: electronicOngoingCount,
                newPropertyCount: newPropertiesCount,
                totalCustomerCount: customerCount || 0,
            },
            todaySchedules: widgetSchedules,
            recentContracts: mergedRecent
        };

        return NextResponse.json(dashboardData);

    } catch (error) {
        console.error('Dashboard API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
