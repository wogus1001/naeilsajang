import { NextResponse } from 'next/server';
import { getContracts, uCanSignClient } from '@/lib/ucansign/client';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const status = searchParams.get('status');

        // If status is specific, fetch that. Otherwise fetch both ongoing and completed.
        let contracts: any[] = [];

        // Hybrid Approach: Fetch from API List AND Local Store (Detail Fetch)

        // 1. Fetch from API List
        console.log(`[API] Fetching contracts with status: ${status || 'ALL'}`);
        const apiContracts = await getContracts(userId, status || undefined) || [];
        console.log(`[API] Fetched ${apiContracts.length} contracts.`);

        // 2. Fetch from Local Store
        const filePath = path.join(process.cwd(), 'src/data/contracts.json');

        let localContracts: any[] = [];
        if (fs.existsSync(filePath)) {
            const fileData = fs.readFileSync(filePath, 'utf8');
            try {
                const allLocal = JSON.parse(fileData);
                // Filter by user
                const userLocal = allLocal.filter((c: any) => c.userId === userId);

                // Fetch fresh status for each local contract
                // Can use getTemplate or getDocument? getTemplate is for templates.
                // We need a getDocument function. client.ts has getContracts (list).
                // We need to add getDocument(userId, docId) to client.ts or just call uCanSignClient directly here?
                // Better to add getDocument to client. We'll assume it exists or use uCanSignClient.

                // Actually, let's use uCanSignClient import

                localContracts = await Promise.all(userLocal.map(async (c: any) => {
                    try {
                        const detail = await uCanSignClient(userId, `/documents/${c.ucansignId}`);
                        if (detail?.result) {
                            return {
                                ...detail.result,
                                id: detail.result.documentId,
                                documentName: detail.result.name, // Normalise
                                // Keep local valid if remote fails? No, remote is truth.
                            };
                        }
                        return c; // Fallback to local data if fetch fails
                    } catch (e) {
                        return c;
                    }
                }));

            } catch (e) { console.error("Local read error", e); }
        }

        // 3. Merge and Dedup
        const map = new Map();
        apiContracts.forEach(c => map.set(c.id, c));
        localContracts.forEach(c => map.set(c.id, c)); // Local (refreshed) overwrites API list if duplicate

        contracts = Array.from(map.values());

        // DEBUG: Log statuses
        contracts.forEach((c: any) => {
            console.log(`Contract Debug [${c.id}]: Status='${c.status}', Name='${c.documentName}'`);
        });

        // Sort
        contracts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json({ contracts });
    } catch (error: any) {
        console.error('API Error:', error);

        // Check for auth-related errors to trigger re-login UI
        const errMsg = error.message?.toLowerCase() || '';
        if (errMsg.includes('unauthorized') || errMsg.includes('reconnect') || errMsg.includes('token') || errMsg.includes('not connected')) {
            return NextResponse.json({ code: 'NEED_AUTH', error: 'Authentication required' }, { status: 401 });
        }

        return NextResponse.json({ error: error.message || 'Failed to fetch contracts' }, { status: 500 });
    }
}
