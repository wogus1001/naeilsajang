cd 
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const rawEmail = searchParams.get('email');
    const rawName = searchParams.get('name');

    // Clean brackets if user included them literal like [email]
    const uploaderEmail = rawEmail ? rawEmail.replace(/^\[|\]$/g, '') : null;
    const testManagerName = rawName ? rawName.replace(/^\[|\]$/g, '') : null;

    if (!uploaderEmail || !testManagerName) {
        return NextResponse.json({ error: 'Missing email or name params' });
    }

    try {
        // 1. Get Uploader
        const { data: uploader } = await supabaseAdmin
            .from('profiles')
            .select('id, name, company_id')
            .eq('email', uploaderEmail)
            .single();

        if (!uploader) return NextResponse.json({ error: 'Uploader not found' });

        // 2. Build Map
        const managerNameMap = new Map<string, string>();
        const { data: colleagues } = await supabaseAdmin
            .from('profiles')
            .select('id, name')
            .eq('company_id', uploader.company_id);

        colleagues?.forEach((col: any) => {
            if (col.name) {
                const n = col.name.trim().normalize('NFC');
                managerNameMap.set(n, col.id);
                managerNameMap.set(n.replace(/\s+/g, ''), col.id);
            }
        });

        // 3. Test Match
        const cleanParams = String(testManagerName).trim().normalize('NFC');
        let assignedManagerId = null;

        if (managerNameMap.has(cleanParams)) {
            assignedManagerId = managerNameMap.get(cleanParams);
        } else {
            const noSpace = cleanParams.replace(/\s+/g, '');
            if (managerNameMap.has(noSpace)) {
                assignedManagerId = managerNameMap.get(noSpace);
            }
        }

        return NextResponse.json({
            uploader: uploader,
            colleagues: colleagues,
            testName: cleanParams,
            matchResult: assignedManagerId,
            isMatch: !!assignedManagerId,
            mapKeys: Array.from(managerNameMap.keys())
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
