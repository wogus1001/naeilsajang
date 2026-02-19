import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RequesterProfile {
    id: string;
    role: string | null;
    company_id: string | null;
}

function normalizeRawUser(rawUser: string | null | undefined): string | null {
    if (!rawUser) return null;
    const normalized = String(rawUser).trim();
    return normalized.length > 0 ? normalized : null;
}

export function extractRequesterRaw(request: Request, fallbackRaw?: string | null): string | null {
    const { searchParams } = new URL(request.url);

    return normalizeRawUser(
        searchParams.get('requesterId') ||
        searchParams.get('userId') ||
        request.headers.get('x-user-id') ||
        fallbackRaw ||
        null
    );
}

export async function resolveUserUuid(
    supabaseAdmin: SupabaseClient,
    rawUser: string | null | undefined
): Promise<string | null> {
    const normalized = normalizeRawUser(rawUser);
    if (!normalized) return null;
    if (UUID_REGEX.test(normalized)) return normalized;

    const emailCandidate = normalized.includes('@') ? normalized : `${normalized}@example.com`;

    const { data: userByEmail } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', emailCandidate)
        .maybeSingle();

    if (userByEmail?.id) return userByEmail.id;

    if (normalized === 'admin') {
        const { data: adminUser } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .ilike('email', 'admin%')
            .limit(1)
            .maybeSingle();

        if (adminUser?.id) return adminUser.id;
    }

    return null;
}

export async function resolveCompanyIdByName(
    supabaseAdmin: SupabaseClient,
    companyName: string | null | undefined
): Promise<string | null> {
    const normalized = normalizeRawUser(companyName);
    if (!normalized) return null;

    const { data: company } = await supabaseAdmin
        .from('companies')
        .select('id')
        .eq('name', normalized)
        .maybeSingle();

    return company?.id || null;
}

export async function getRequesterProfile(
    supabaseAdmin: SupabaseClient,
    request: Request,
    fallbackRaw?: string | null
): Promise<RequesterProfile | null> {
    const requesterRaw = extractRequesterRaw(request, fallbackRaw);
    const requesterId = await resolveUserUuid(supabaseAdmin, requesterRaw);
    if (!requesterId) return null;

    const { data: requester } = await supabaseAdmin
        .from('profiles')
        .select('id, role, company_id')
        .eq('id', requesterId)
        .maybeSingle();

    if (!requester) return null;

    return {
        id: requester.id,
        role: requester.role,
        company_id: requester.company_id
    };
}

export function isAdmin(requester: RequesterProfile | null): boolean {
    return requester?.role === 'admin';
}

export function canAccessCompanyScope(
    requester: RequesterProfile | null,
    targetCompanyId: string | null | undefined
): boolean {
    if (!requester) return false;
    if (isAdmin(requester)) return true;
    if (!requester.company_id || !targetCompanyId) return false;
    return requester.company_id === targetCompanyId;
}

export function canAccessCompanyResource(
    requester: RequesterProfile | null,
    resource: { company_id: string | null; manager_id?: string | null; user_id?: string | null }
): boolean {
    if (!requester) return false;
    if (isAdmin(requester)) return true;

    if (requester.company_id && resource.company_id && requester.company_id === resource.company_id) {
        return true;
    }

    const ownerId = resource.manager_id || resource.user_id || null;
    if (ownerId && ownerId === requester.id) {
        return true;
    }

    return false;
}
