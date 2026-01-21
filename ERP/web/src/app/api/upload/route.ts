import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const path = formData.get('path') as string;
        const bucket = formData.get('bucket') as string || 'property-images';

        if (!file || !path) {
            return NextResponse.json({ error: 'File and path are required' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .upload(path, buffer, {
                contentType: file.type,
                upsert: true
            });

        if (error) {
            console.error('Supabase Upload Error:', error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        // Get Public URL
        const { data: publicData } = supabaseAdmin.storage
            .from(bucket)
            .getPublicUrl(path);

        return NextResponse.json({
            success: true,
            path: data.path,
            publicUrl: publicData.publicUrl
        });

    } catch (error: any) {
        console.error('Upload API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
