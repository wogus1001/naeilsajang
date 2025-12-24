import { NextResponse } from 'next/server';
import { uCanSignClient } from '@/lib/ucansign/client';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'UserId is required' }, { status: 400 });
    }

    try {
        const body = await request.json();
        const { contractId } = body;

        if (!contractId) {
            return NextResponse.json({ error: 'Contract ID is required' }, { status: 400 });
        }

        // 1. Fetch latest status from UCanSign
        const docRes = await uCanSignClient(userId, `/documents/${contractId}`);

        if (!docRes || !docRes.result) {
            return NextResponse.json({ error: 'Failed to fetch contract details' }, { status: 500 });
        }

        const latestStatus = docRes.result.status;
        const documentName = docRes.result.name;

        // 2. Update Local Store
        const filePath = path.join(process.cwd(), 'src/data/contracts.json');
        let updatedContract = null;
        let contracts: any[] = [];

        if (fs.existsSync(filePath)) {
            const fileData = fs.readFileSync(filePath, 'utf8');
            contracts = JSON.parse(fileData);
        }

        const index = contracts.findIndex((c: any) => c.id === contractId);

        // If contract not found locally, maybe we should add it? 
        // For now, let's assume we update only existing ones or simple append if we want full sync
        // But the main goal is updating status.

        if (index !== -1) {
            contracts[index].status = latestStatus;
            contracts[index].documentName = documentName;
            contracts[index].updatedAt = new Date().toISOString();

            // 3. Auto-Save PDF if Completed
            if ((latestStatus === 'completed' || latestStatus === 'COMPLETED') && !contracts[index].filePath) {
                console.log(`Contract ${contractId} is completed. Downloading file...`);
                try {
                    const fileRes = await uCanSignClient(userId, `/documents/${contractId}/file`);
                    if (fileRes?.code === 0 && fileRes?.result?.file) {
                        const downloadUrl = fileRes.result.file;
                        const fileResponse = await fetch(downloadUrl);

                        if (fileResponse.ok) {
                            const uploadDir = path.join(process.cwd(), 'public/uploads/contracts');
                            if (!fs.existsSync(uploadDir)) {
                                fs.mkdirSync(uploadDir, { recursive: true });
                            }

                            const fileName = `${contractId}.pdf`;
                            const destPath = path.join(uploadDir, fileName);

                            const arrayBuffer = await fileResponse.arrayBuffer();
                            const buffer = Buffer.from(arrayBuffer);

                            fs.writeFileSync(destPath, buffer);

                            contracts[index].filePath = `/uploads/contracts/${fileName}`;
                            contracts[index].downloadedAt = new Date().toISOString();
                            console.log(`Saved contract file to ${destPath}`);
                        }
                    }
                } catch (err) {
                    console.error('Failed to auto-save contract file:', err);
                }
            }

            updatedContract = contracts[index];

            // 4. Update Property Status & Attach File if linked
            if ((latestStatus === 'completed' || latestStatus === 'COMPLETED') && contracts[index].propertyId && contracts[index].filePath) {
                try {
                    const propsPath = path.join(process.cwd(), 'src/data/properties.json');
                    if (fs.existsSync(propsPath)) {
                        const propsData = fs.readFileSync(propsPath, 'utf8');
                        let properties = JSON.parse(propsData);

                        const propIndex = properties.findIndex((p: any) => String(p.id) === String(contracts[index].propertyId));

                        if (propIndex !== -1) {
                            const targetProp = properties[propIndex];

                            // Update Status
                            if (targetProp.status !== 'contract_completed') {
                                targetProp.status = 'contract_completed'; // Or similar status key used in app
                            }

                            // Add to contracts list
                            if (!targetProp.contracts) targetProp.contracts = [];

                            // Check for duplicates
                            const alreadyLinked = targetProp.contracts.some((c: any) => c.contractId === contractId);

                            if (!alreadyLinked) {
                                targetProp.contracts.push({
                                    contractId: contractId,
                                    documentName: documentName,
                                    status: latestStatus,
                                    filePath: contracts[index].filePath,
                                    linkedAt: new Date().toISOString()
                                });
                            }

                            fs.writeFileSync(propsPath, JSON.stringify(properties, null, 2));
                            console.log(`Auto-updated property ${targetProp.id} with contract info.`);
                        }
                    }
                } catch (propErr) {
                    console.error('Failed to update property data:', propErr);
                }
            }
        }

        // Save changes to disk
        fs.writeFileSync(filePath, JSON.stringify(contracts, null, 2));

        return NextResponse.json({
            success: true,
            status: latestStatus,
            contract: updatedContract || docRes.result
        });

    } catch (error: any) {
        console.error('Sync Error:', error);
        return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
    }
}
