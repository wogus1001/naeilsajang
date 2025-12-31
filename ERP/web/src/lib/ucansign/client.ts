
import { createClient } from '@supabase/supabase-js';

export const UCANSIGN_BASE_URL = process.env.UCANSIGN_BASE_URL || 'https://app.ucansign.com/openapi';

// Service Role Client (for backend token management)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

interface RequestOptions extends RequestInit {
    headers?: Record<string, string>;
}

// Helper to update token in DB
const updateTokenInDB = async (userId: string, authResult: any) => {
    try {
        const { error } = await supabaseAdmin.from('profiles').update({
            ucansign_access_token: authResult.accessToken,
            ucansign_refresh_token: authResult.refreshToken, // Maintain if new one not provided? uCanSign usually rotates.
            ucansign_expires_at: Date.now() + (29 * 60 * 1000)
        }).eq('id', userId);

        if (error) console.error('Failed to update token in Supabase:', error);
    } catch (e) {
        console.error('Failed to update token in DB:', e);
    }
};

// Helper to disconnect user (clear tokens)
const disconnectUserInDB = async (userId: string) => {
    try {
        const { error } = await supabaseAdmin.from('profiles').update({
            ucansign_access_token: null,
            ucansign_refresh_token: null,
            ucansign_expires_at: null
        }).eq('id', userId);
        if (error) console.error('Failed to disconnect user in Supabase:', error);
    } catch (e) {
        console.error('Failed to disconnect user in DB:', e);
    }
};

const getUserToken = async (userId: string, forceRefresh = false): Promise<string> => {
    // 1. Read User Data from Supabase
    const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('ucansign_access_token, ucansign_refresh_token, ucansign_expires_at')
        .eq('id', userId)
        .single();

    if (error || !profile || !profile.ucansign_access_token) {
        throw new Error('User is not connected to UCanSign');
    }

    const { ucansign_access_token: accessToken, ucansign_refresh_token: refreshToken, ucansign_expires_at: expiresAt } = profile;

    // 2. Check Expiry (with 2 min buffer) OR Force Refresh
    // expiresAt is bigint/number
    if (!forceRefresh && Date.now() < Number(expiresAt) - 120000) {
        return accessToken;
    }

    // 3. Refresh Token
    console.log(`Refreshing token for user ${userId} (Force: ${forceRefresh})...`);
    try {
        const payload: any = {
            grantType: 'refresh',
            clientId: process.env.UCANSIGN_CLIENT_ID,
            clientSecret: process.env.UCANSIGN_CLIENT_SECRET,
            accessToken: accessToken,
        };
        if (refreshToken) payload.refreshToken = refreshToken;

        const response = await fetch(`${UCANSIGN_BASE_URL}/user/oauth/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (data.msg?.toLowerCase() === 'success' && data.result?.accessToken) {
            // Success - Update DB
            await updateTokenInDB(userId, data.result);
            return data.result.accessToken;
        } else {
            console.error('Refresh Failed:', data);
            // If refresh fails, disconnect the user to prevent stuck state
            await disconnectUserInDB(userId);
            throw new Error('Failed to refresh token. Please reconnect UCanSign.');
        }

    } catch (e) {
        console.error('Refresh Error:', e);
        // If critical network error or other, we might not want to disconnect immediately, but for now assuming auth failure is likely
        if (e instanceof Error && e.message.includes('reconnect')) {
            throw e; // Already disconnected above
        }
        throw e;
    }
};

export const uCanSignClient = async (userId: string, endpoint: string, options: RequestOptions = {}, isRetry = false): Promise<any> => {
    try {
        if (!userId) throw new Error('UserId is required for UCanSign API calls');

        const token = await getUserToken(userId); // Normal fetch

        const url = `${UCANSIGN_BASE_URL}${endpoint}`;

        const defaultHeaders: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'UCanSign-Connect/1.0',
        };

        if (options.method !== 'GET' && options.body && !options.headers?.['Content-Type']) {
            defaultHeaders['Content-Type'] = 'application/json';
        }

        const config: RequestInit = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers,
            },
        };

        const response = await fetch(url, config);


        // Check for HTTP 401 first
        if (response.status === 401) {
            if (!isRetry) {
                console.log("HTTP 401 detected. Retrying with force refresh...");
                await getUserToken(userId, true);
                return uCanSignClient(userId, endpoint, options, true);
            }
            throw new Error('Unauthorized (401). Token may be invalid.');
        }

        if (response.status === 402) {
            throw new Error('Payment Required (402). Points exhausted.');
        }

        if (response.status === 204) return null;

        const textBody = await response.text();
        let resultBody;
        try {
            // BigInt handling: Wrap large numbers (15+ digits) in string IDs with quotes
            // Targets: "id": 123... , "documentId": 123... etc.
            const cleanText = textBody.replace(/"((?:document|folder|user|participant|attachment)?Id|id)"\s*:\s*(\d{15,})/g, '"$1": "$2"');
            resultBody = JSON.parse(cleanText);
        } catch (e) {
            console.error('Failed to parse (BigInt safe) JSON:', e);
            resultBody = JSON.parse(textBody); // Fallback
        }

        // Check for Logic 401 (HTTP 200 but code 401)
        if (resultBody.code === 401) {
            if (!isRetry) {
                console.log("Logic 401 (Code 401) detected. Retrying with force refresh...");
                await getUserToken(userId, true);
                return uCanSignClient(userId, endpoint, options, true);
            }
            throw new Error('Unauthorized (Logic 401). Token expired.');
        }

        if (!response.ok) {
            // Already read body, verify if we can throw with it
            throw new Error(`API Error: ${response.status} - ${resultBody.msg || JSON.stringify(resultBody)}`);
        }

        return resultBody;
    } catch (error) {
        console.error('DEBUG CAUGHT ERROR in Client:', error);
        throw error;
    }
};

export interface Contract {
    documentId: string;
    name: string;
    userId: string;
    status: string;
    createdAt?: string;
    updatedAt?: string;
    id?: string;
    documentName?: string;
    folderId?: string; // Changed to string
}

export const getContracts = async (userId: string, status?: string): Promise<Contract[]> => {
    let url = '/documents?currentPage=1&limit=10';

    // Special handling for 'archived' based on the action endpoints
    if (status === 'archived' || status === 'trash') {
        url = '/documents/archive?currentPage=1&limit=10';
    } else if (status) {
        url += `&status=${status}`;
    }

    console.log(`[UCanSignClient] Requesting: ${url}`);
    const response = await uCanSignClient(userId, url);
    // console.log('Documents Response:', JSON.stringify(response, null, 2));
    const list = response?.result?.record?.list || response?.result?.list || [];
    console.log(`[UCanSignClient] Returned ${list.length} items for status ${status}`);

    return list.map((item: any) => ({
        ...item,
        id: item.documentId,
        documentName: item.name,
        // Ensure status is normalised for UI if needed
        status: status === 'archived' || status === 'trash' ? 'trash' : item.status,
        folderId: item.folderId // Explicitly map
    }));
};

export interface Template {
    documentId: string;
    name: string;
    status: string;
    createdAt: string;
}

export const getTemplates = async (userId: string): Promise<Template[]> => {
    // Correct endpoint based on Postman collection
    // Using currentPage matching documents endpoint pattern
    const response = await uCanSignClient(userId, '/templates?currentPage=1&limit=10');
    console.log('Templates Response:', JSON.stringify(response, null, 2));
    const list = response?.result?.record?.list || response?.result?.list || [];

    return list.map((item: any) => ({
        documentId: item.documentId,
        name: item.name,
        status: item.status,
        createdAt: item.createdAt,
    }));
};

export const getTemplate = async (userId: string, documentId: string): Promise<any> => {
    // Fetch detailed info about the template
    const response = await uCanSignClient(userId, `/templates/${documentId}`);
    return response?.result;
};

// 3. Document History
export const getDocumentHistory = async (userId: string, documentId: string) => {
    const response = await uCanSignClient(userId, `/documents/${documentId}/histories`);
    return response?.result || [];
};

// 5. Audit Trail
export const getAuditTrail = async (userId: string, documentId: string) => {
    const response = await uCanSignClient(userId, `/documents/${documentId}/audit-trail`);
    return response?.result?.file;
};

// 6. Participant Fields
export const getParticipantFields = async (userId: string, documentId: string, participantId: string) => {
    const response = await uCanSignClient(userId, `/documents/${documentId}/participants/${participantId}/fields`);
    return response?.result || [];
};

// 7. Attachments List
export const getAttachments = async (userId: string, documentId: string) => {
    const response = await uCanSignClient(userId, `/documents/${documentId}/attachments`);
    return response?.result || [];
};

// 8. Attachment Download
export const getAttachmentFile = async (userId: string, documentId: string, attachmentId: string) => {
    const response = await uCanSignClient(userId, `/documents/${documentId}/attachments/${attachmentId}`);
    return response?.result?.file;
};

// 18. Full File Download
export const getFullFile = async (userId: string, documentId: string) => {
    const response = await uCanSignClient(userId, `/documents/${documentId}/full-file`);
    return response?.result?.file;
};

// --- FOLDERS ---

export interface ContractFolder {
    folderId: string; // Changed to string for precision
    name: string;
    documentId?: string; // Changed to string
}

// 1. Get Folders
export const getFolders = async (userId: string) => {
    const response = await uCanSignClient(userId, '/folders');
    // Result is directly an array in 'reulst' (typo in docs 'reulst' -> likely 'result')
    // Docs say: { msg: "success", "reulst": [...] }
    // Checking logs might be needed if "reulst" is real typo in API or just docs. Assuming 'result' for now or checking both.
    return response?.result || response?.reulst || [];
};

// 2. Create Folder
export const createFolder = async (userId: string, name: string) => {
    const response = await uCanSignClient(userId, '/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    return response?.result || response?.reulst;
};

// 3. Rename Folder
export const renameFolder = async (userId: string, folderId: string, name: string) => {
    return await uCanSignClient(userId, `/folders/${folderId}/name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
};

// 4. Delete Folder
// 4. Delete Folder
export const deleteFolder = async (userId: string, folderId: string) => {
    console.log(`[Client] deleteFolder. Folder: ${folderId}`);
    const result = await uCanSignClient(userId, `/folders/${folderId}`, {
        method: 'DELETE'
    });
    console.log('[Client] delete response:', result);
    return result;
};

// 5. Move Documents to Folder
export const moveDocumentsToFolder = async (userId: string, folderId: string, documentIds: string[]) => {
    console.log(`[Client] moveDocumentsToFolder. Folder: ${folderId}, Docs:`, documentIds);
    // Final Fix: IDs are BigInt strings. API expects array of strings.
    // The previous BigInt parser ensures we have correct strings.
    // We send standard JSON ["id1", "id2"].
    const result = await uCanSignClient(userId, `/folders/${folderId}/documents`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(documentIds)
    });
    console.log('[Client] move response:', result);
    return result;
};

// --- POINTS ---

// 1. Balance
export const getPointBalance = async (userId: string) => {
    const response = await uCanSignClient(userId, '/point/balance');
    return response?.result?.balance;
};

// 2. Charge History
export const getPointChargeHistory = async (userId: string) => {
    const response = await uCanSignClient(userId, '/point/charge/history');
    return response?.result?.list || [];
};

// 3. Usage History
export const getPointUsageHistory = async (userId: string) => {
    const response = await uCanSignClient(userId, '/point/usage/history');
    return response?.result?.list || [];
};

// --- EMBEDDING ---

// 1. Sign Creating Embedding
// POST /openapi/embedding/sign-creating
export const createSignEmbedding = async (userId: string, data: {
    redirectUrl: string;
    customValue?: string;
    customValue1?: string;
    customValue2?: string;
    customValue3?: string;
    customValue4?: string;
    customValue5?: string;
}) => {
    return await uCanSignClient(userId, '/embedding/sign-creating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
};

// 2. View Document Embedding
// POST /openapi/embedding/view/:documentId
export const viewDocumentEmbedding = async (userId: string, documentId: string, data: {
    participantId?: string;
    redirectUrl: string;
}) => {
    return await uCanSignClient(userId, `/embedding/view/${documentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
};

// 3. Template Creating Embedding
// POST /openapi/embedding/template-creating
export const createTemplateEmbedding = async (userId: string, data: {
    redirectUrl: string;
}) => {
    return await uCanSignClient(userId, '/embedding/template-creating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
};

// 4. Template Modifying Embedding
// POST /openapi/embedding/template-modifying/:documentId
export const modifyTemplateEmbedding = async (userId: string, documentId: string, data: {
    redirectUrl: string;
}) => {
    return await uCanSignClient(userId, `/embedding/template-modifying/${documentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
};

// --- CONTRACT CREATION (TEMPLATE) ---

// POST /openapi/templates/:templateId
export const createContractFromTemplate = async (userId: string, templateId: string, data: {
    documentName?: string;
    folderId?: number; // Long in Java usually maps to number in JS, but careful with precision. String if large.
    configExpireMinute?: number;
    documentPassword?: string;
    configExpireReminderDay?: number;
    reservationDate?: string;
    processType?: 'PROCEDURE' | 'FACE_TO_FACE';
    isSequential?: boolean;
    isSendMessage?: boolean;
    fields?: Array<{
        fieldId?: string | number;
        fieldName?: string;
        value: string | boolean;
    }>;
    participants: Array<{
        signingOrder: number;
        name: string;
        message?: string;
        signingMethodType: 'email' | 'kakao' | 'none';
        signingContactInfo?: string;
        authentications?: Array<{
            authType: 'password' | 'mobile_identification' | 'mobile_otp';
            authValuePassword?: string;
            authValueName?: string;
            authValuePhone?: string;
        }>;
    }>;
    payment?: {
        productName: string;
        price: number | string;
    };
    customValue?: string;
    customValue1?: string;
    customValue2?: string;
    customValue3?: string;
    customValue4?: string;
    customValue5?: string;
}) => {
    return await uCanSignClient(userId, `/templates/${templateId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
};
