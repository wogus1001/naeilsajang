import type { VerifiedTossAuthIdentity } from '../types';

interface TossAuthApiError {
  errorCode: string;
  reason: string;
}

interface TossAuthApiSuccess<T> {
  resultType: 'SUCCESS';
  success: T;
}

interface TossAuthApiFailure {
  resultType: 'FAIL';
  error: TossAuthApiError;
}

type TossAuthApiResponse<T> = TossAuthApiSuccess<T> | TossAuthApiFailure;

interface TossAuthExchangeRequest {
  authorizationCode: string;
  referrer: 'DEFAULT' | 'sandbox' | 'SANDBOX';
}

function getApiBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_TOSS_AUTH_API_BASE_URL;
  return typeof baseUrl === 'string' ? baseUrl.trim() : '';
}

function toApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  return baseUrl.length > 0 ? `${baseUrl}${path}` : path;
}

function extractErrorReason(payload: unknown, fallback: string): string {
  if (typeof payload !== 'object' || payload === null) {
    return fallback;
  }

  const maybeFailure = payload as Partial<TossAuthApiFailure> & {
    error?: Partial<TossAuthApiError> | string;
  };

  if (
    maybeFailure.error &&
    typeof maybeFailure.error === 'object' &&
    typeof maybeFailure.error.reason === 'string'
  ) {
    return maybeFailure.error.reason;
  }

  if (typeof maybeFailure.error === 'string') {
    return maybeFailure.error;
  }

  return fallback;
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(toApiUrl(path), {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const payload: unknown = await response
    .json()
    .catch(() => ({ resultType: 'FAIL', error: { errorCode: 'INVALID_JSON', reason: '응답을 읽지 못했어요.' } }));

  if (!response.ok) {
    throw new Error(extractErrorReason(payload, `로그인 요청에 실패했어요. (${response.status})`));
  }

  return payload as T;
}

export async function exchangeTossAuthorizationCode(
  request: TossAuthExchangeRequest,
): Promise<VerifiedTossAuthIdentity> {
  const response = await requestJson<TossAuthApiResponse<VerifiedTossAuthIdentity>>(
    '/api/auth/toss/login',
    {
      method: 'POST',
      body: JSON.stringify(request),
    },
  );

  if (response.resultType === 'FAIL') {
    throw new Error(response.error.reason);
  }

  return response.success;
}

export async function revokeTossServerSession(): Promise<void> {
  try {
    await requestJson<TossAuthApiResponse<{ revoked: boolean }>>('/api/auth/toss/logout', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  } catch {
    // 로그아웃은 로컬 상태 정리가 우선이라 서버 실패는 무시해요.
  }
}
