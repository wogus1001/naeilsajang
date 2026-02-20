type ApiEnvelope<T = unknown> = {
    data?: T;
    error?: string | boolean;
    code?: string;
    message?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function unwrapApiData<T = any>(payload: unknown): T {
    if (isObject(payload) && 'data' in payload) {
        return (payload as ApiEnvelope<T>).data as T;
    }
    return payload as T;
}

export function readApiError(payload: unknown): string {
    if (isObject(payload) && typeof payload.message === 'string') {
        return payload.message;
    }
    if (isObject(payload) && typeof payload.error === 'string') {
        return payload.error;
    }
    return 'Request failed.';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readApiJson<T = any>(response: Response): Promise<T> {
    const payload = await response.json();
    return unwrapApiData<T>(payload);
}
