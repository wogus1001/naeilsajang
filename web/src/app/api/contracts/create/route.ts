import { NextResponse } from 'next/server';
import { uCanSignClient } from '@/lib/ucansign/client';

export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        const body = await request.json();
        const { templateId, participants: participantMap, propertyId } = body;

        // 1. Fetch Template Details to get original participant structure
        const templateRes = await uCanSignClient(userId, `/templates/${templateId}`);
        if (!templateRes?.result) {
            return NextResponse.json({ error: 'Failed to fetch template details' }, { status: 500 });
        }

        const templateData = templateRes.result;
        const originalParticipants = templateData.participants || [];

        // 2. Build Request Body for Contract Creation
        // Map UI inputs to UCanSign API structure
        const apiParticipants = originalParticipants.map((p: any) => {
            // If it's the requester (the user), we assume they are already handled or use their account info
            if (p.participantRole === 'requester') {
                return {
                    name: templateData.requester?.name || '요청자', // Fallback or use real name if available
                    signingMethodType: 'email', // Default
                    signingContactInfo: templateData.requester?.email || 'user@example.com', // Need a way to get real user email
                    signingOrder: p.signingOrder,
                    // auth info if needed
                };
            }

            // For other participants (Tenant, etc.)
            const inputInfo = participantMap[p.participantId];
            if (!inputInfo) {
                // If mapping is missing but required, this might fail. 
                // We'll try to provide minimal valid data or throw error.
                throw new Error(`Missing info for role: ${p.roleName}`);
            }

            return {
                name: inputInfo.name,
                signingMethodType: inputInfo.contact.includes('@') ? 'email' : 'kakao', // Simple heuristic
                signingContactInfo: inputInfo.contact,
                signingOrder: p.signingOrder,
                message: "전자계약 서명 요청드립니다."
            };
        });

        const createPayload = {
            documentName: templateData.name, // Use template name
            // folderId: ... (optional)
            fields: [], // We are not mapping fields yet, assuming template pre-filled or fields filled by participants
            participants: apiParticipants,
            isSendMessage: true, // Send email/kakao immediately
        };

        // 3. Call UCanSign API
        // POST /openapi/templates/:documentId
        const createRes = await uCanSignClient(userId, `/templates/${templateId}`, {
            method: 'POST',
            body: JSON.stringify(createPayload)
        });

        if (createRes?.code !== 0) {
            return NextResponse.json({
                error: createRes?.msg || 'Failed to create contract',
                details: createRes
            }, { status: 500 });
        }

        // Success
        const newContract = {
            id: createRes.result.documentId,
            userId: userId, // Internal user ID currently used for auth mapping
            ucansignId: createRes.result.documentId,
            name: createPayload.documentName,
            status: 'on_going', // Default start status
            createdAt: new Date().toISOString(),
            propertyId: propertyId || null // Save propertyId
        };

        // Save to local store workaround
        try {
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(process.cwd(), 'src/data/contracts.json');

            let contracts = [];
            if (fs.existsSync(filePath)) {
                const fileData = fs.readFileSync(filePath, 'utf8');
                if (fileData) contracts = JSON.parse(fileData);
            }
            contracts.push(newContract);
            fs.writeFileSync(filePath, JSON.stringify(contracts, null, 2));
            console.log('Saved contract to local store:', newContract.id);
        } catch (err) {
            console.error('Failed to save local contract:', err);
        }

        return NextResponse.json({ success: true, result: createRes.result });

    } catch (error: any) {
        console.error('Contract Creation Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
