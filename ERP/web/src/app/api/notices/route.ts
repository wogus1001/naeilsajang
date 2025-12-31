import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Service Role Client moved to handlers

// GET: Fetch notices (System + Team)
export async function GET(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { searchParams } = new URL(request.url);
        const companyName = searchParams.get('companyName');
        const limit = searchParams.get('limit');

        // 1. Resolve Company ID if needed
        let companyId = null;
        if (companyName) {
            const { data: company } = await supabaseAdmin.from('companies').select('id').eq('name', companyName).single();
            if (company) companyId = company.id;
        }

        // 2. Build Query
        let query = supabaseAdmin
            .from('notices')
            .select(`
                *,
                author:profiles!author_id(name, role)
            `)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false });

        if (companyId) {
            // (type = 'system' AND company_id IS NULL) OR (company_id = :companyId)
            // Supabase 'or' syntax: "condition1,condition2"
            query = query.or(`company_id.is.null,company_id.eq.${companyId}`);
        } else {
            // If no company context, only show system notices
            query = query.is('company_id', null);
        }

        if (limit) {
            query = query.limit(parseInt(limit));
        }

        const { data: notices, error } = await query;

        if (error) throw error;

        // Transform for frontend compatibility if needed
        // (Date format, author info structure, etc.)
        const formatted = notices.map(n => ({
            ...n,
            createdAt: new Date(n.created_at).toLocaleDateString().replace(/-/g, '.'), // Keep YYYY.MM.DD
            authorName: n.author?.name || '관리자', // Join profile name
            authorRole: n.author?.role || 'admin',
            // isPinned is snake_case in DB, camelCase in frontend? map if needed
            isPinned: n.is_pinned
        }));

        return NextResponse.json(formatted);
    } catch (error) {
        console.error('Fetch notices error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST: Create Notice
export async function POST(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const body = await request.json();
        const { title, content, type, authorId, companyName, isPinned } = body;

        // Resolve IDs
        // Author
        const email = `${authorId}@example.com`;
        const { data: author } = await supabaseAdmin.from('profiles').select('id').eq('email', email).single();
        if (!author) return NextResponse.json({ error: 'Author not found' }, { status: 400 });

        // Company
        let companyUuid = null;
        if (type === 'team' && companyName) {
            const { data: company } = await supabaseAdmin.from('companies').select('id').eq('name', companyName).single();
            if (company) companyUuid = company.id;
        }

        const { data: newNotice, error } = await supabaseAdmin
            .from('notices')
            .insert({
                title,
                content,
                type,
                author_id: author.id,
                company_id: companyUuid,
                is_pinned: isPinned || false
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(newNotice);
    } catch (error) {
        console.error('Create notice error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
