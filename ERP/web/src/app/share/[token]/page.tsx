import { BriefingViewer } from '@/components/briefing/BriefingViewer';
import { notFound } from 'next/navigation';

// Allow this page to be static-generated or dynamic (since it depends on token query)
// Since it's dynamic route [token], it's dynamic by default.
export const dynamic = 'force-dynamic';

async function getBriefingData(token: string) {
    console.log('[BriefingPage] Fetching data for token:', token);
    const { createAdminClient } = await import('@/utils/supabase/admin');
    const supabaseAdmin = createAdminClient();

    const { data: link, error: linkError } = await supabaseAdmin
        .from('share_links')
        .select('*')
        .eq('token', token)
        .single();

    if (linkError) console.error('[BriefingPage] Link Error:', linkError);
    if (!link) {
        console.log('[BriefingPage] Link not found for token:', token);
        return null;
    }

    console.log('[BriefingPage] Link found:', link.id, 'Expires:', link.expires_at);

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
        console.log('[BriefingPage] Link expired');
        return { error: 'expired' };
    }

    // Fetch Property
    const { data: property, error: propError } = await supabaseAdmin
        .from('properties')
        .select('*')
        .eq('id', link.property_id)
        .single();

    if (propError) console.error('[BriefingPage] Property Error:', propError);

    if (!property) {
        console.log('[BriefingPage] Property not found for ID:', link.property_id);
        return null;
    }

    console.log('[BriefingPage] Property found:', property.name);

    // Mask Data (Duplicate logic from API - ideally strict util function)
    const options = link.options || {};
    const { hide_address, show_briefing_price } = options;

    // Prepare minimal data for frontend
    console.log('[BriefingPage] Property Data Keys:', Object.keys(property.data || {}));

    // Check keys in data JSON (typically camelCase from frontend)
    const pData = property.data || {};
    // Handle nested coordinates object (common in PropertyCard save)
    // Ensure they are numbers for the Map component
    const rawLat = pData.coordinates?.lat || pData.lat || pData.latitude;
    const rawLng = pData.coordinates?.lng || pData.lng || pData.longitude;
    const lat = parseFloat(rawLat) || 0;
    const lng = parseFloat(rawLng) || 0;

    // Ensure financial data is passed correctly
    const parseNum = (val: any) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') return parseFloat(val.replace(/,/g, '')) || 0;
        return 0;
    };

    console.log('[BriefingPage] Resolved Coords:', lat, lng);

    const briefingPrice = parseNum(pData.briefingPrice || pData.briefing_price || 0);
    const deposit = parseNum(pData.deposit || 0);
    const premium = parseNum(pData.premium || 0);
    const realTotal = deposit + premium;

    // Use price_mode from options, default to 'include' (fallback to legacy show_briefing_price logic if needed)
    // Legacy: show_briefing_price boolean.
    // New: price_mode string 'include' | 'exclude'.
    let displayPrice = realTotal;

    if (options.price_mode === 'exclude') {
        // Exclude Briefing Price: (Deposit + Premium) - BriefingPrice
        displayPrice = realTotal - briefingPrice;
    } else if (options.price_mode === 'include') {
        // Include Briefing Price: Deposit + Premium
        displayPrice = realTotal;
    } else {
        // Legacy Fallback
        if (show_briefing_price) {
            // Assume user meant Briefing Price itself? Or Exclude?
            // Legacy behavior was: show briefingPrice. But user said "Briefing Price Included = D+P".
            // Let's stick to realTotal for safety unless explicitly excluded.
            displayPrice = realTotal;
        }
    }

    // Ensure financial data is passed correctly (handle string/number formatting if needed)
    // PropertyCard saves them as numbers usually, but sometimes strings with commas?
    // Let's ensure they are numbers.


    const maskedProperty = {
        ...property,
        data: {
            ...pData,
            lat,
            lng,
            // Ensure these specific keys exist for InvestmentCalculator
            monthlyRevenue: parseNum(pData.monthlyRevenue),
            laborCost: parseNum(pData.laborCost),
            rentMaintenance: parseNum(pData.rentMaintenance), // 임대료 + 관리비
            materialCostPercent: pData.materialCostPercent !== undefined && pData.materialCostPercent !== '' ? parseNum(pData.materialCostPercent) : 30,
            deposit: parseNum(pData.deposit),
            premium: parseNum(pData.premium),
            // New fields for accurate calculation
            taxUtilities: parseNum(pData.taxUtilities), // 제세공과금
            maintenance: parseNum(pData.maintenanceDepreciation),   // 유지보수 (Correct Key)
            otherExpenses: parseNum(pData.promoMisc), // 기타경비 (Correct Key)
        },
        address: hide_address ? null : property.address,
        masked_address: property.address ? property.address.split(' ').slice(0, 2).join(' ') + ' ***' : 'Address Hidden',
        price: displayPrice,
    };

    return { property: maskedProperty, options };
}

export default async function BriefingPage(props: { params: Promise<{ token: string }> }) {
    const params = await props.params;
    console.log('[BriefingPage] Page requested for token:', params.token);
    const data = await getBriefingData(params.token);

    if (!data) {
        notFound();
    }

    if ('error' in data && data.error === 'expired') {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-50 p-4">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-800">기간이 만료된 브리핑입니다.</h1>
                    <p className="mt-2 text-gray-600">담당자에게 다시 문의해주세요.</p>
                </div>
            </div>
        );
    }

    return <BriefingViewer data={data} token={params.token} />;
}
