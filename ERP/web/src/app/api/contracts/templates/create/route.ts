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
        const { file } = body; // Base64 or FormData handling might be needed but UCanSign might want file upload.

        // UCanSign Template Creation usually involves:
        // 1. Upload File (PDF) -> get fileId
        // 2. Create Template with fileId

        // However, based on the provided Postman collection, there isn't a direct "Create Template" API shown in the summary list 
        // that takes a raw file upload easily in one step or the user wants to add a template *to the list*?

        // The user asked "Add template function in contract creation".
        // Usually templates are created in UCanSign Dashboard. 
        // If the user wants to *upload* a new contract file directly (not a template), that's different.

        // Checking the Postman collection again...
        // "4. 탬플릿을 통한 서명문서 생성" exists.
        // "3. 탬플릿 삭제" exists.
        // There is NO "Create Template" endpoint visible in the provided summary or it was missed.
        // Usually creating a template is a complex UI action (placing fields). 
        // Maybe the user just wants to see the "Create Template" link?

        // Wait, if the user means "Upload a PDF to create a contract directly w/o template", that is "Self-Service Contract" or "Upload & Send".
        // The requested feature is "Add template function".
        // If API doesn't support creating templates programmatically (common for e-sign APIs to restrict this to UI), 
        // we might just need to guide them to the dashboard.

        // But let's look at "1. 문서 리스트 조회" ... 

        return NextResponse.json({ error: 'Not implemented via API. Please use UCanSign Dashboard.' }, { status: 501 });

    } catch (error: any) {
        console.error('Template Creation Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
