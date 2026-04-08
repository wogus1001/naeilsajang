import type {
  AuthIdentity,
  ChecklistItem,
  CompletionRecord,
  StoreDataBundle,
  StoreProfile,
  Worker,
} from '../types';

interface RemoteApiError {
  errorCode: string;
  reason: string;
}

interface RemoteApiSuccess<T> {
  resultType: 'SUCCESS';
  success: T;
}

interface RemoteApiFailure {
  resultType: 'FAIL';
  error: RemoteApiError;
}

type RemoteApiResponse<T> = RemoteApiSuccess<T> | RemoteApiFailure;

interface RestoreStoreSuccess {
  found: boolean;
  bundle: StoreDataBundle | null;
}

interface SyncProfileSuccess {
  storeId: string;
}

function getApiBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_TOSS_AUTH_API_BASE_URL;
  return typeof baseUrl === 'string' ? baseUrl.trim() : '';
}

function toApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  return baseUrl.length > 0 ? `${baseUrl}${path}` : path;
}

function isDisabledRemoteReason(reason: string): boolean {
  return (
    reason.includes('Supabase') ||
    reason.includes('SUPABASE') ||
    reason.includes('설정되지 않았') ||
    reason.includes('찾지 못했')
  );
}

async function requestRemote<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const response = await fetch(toApiUrl(path), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload: unknown = await response
      .json()
      .catch(() => ({
        resultType: 'FAIL',
        error: { errorCode: 'INVALID_JSON', reason: '응답을 읽지 못했어요.' },
      }));

    if (!response.ok) {
      if (
        typeof payload === 'object' &&
        payload !== null &&
        'error' in payload &&
        typeof (payload as RemoteApiFailure).error?.reason === 'string' &&
        isDisabledRemoteReason((payload as RemoteApiFailure).error.reason)
      ) {
        return null;
      }

      return null;
    }

    const typedPayload = payload as RemoteApiResponse<T>;

    if (typedPayload.resultType === 'FAIL') {
      if (isDisabledRemoteReason(typedPayload.error.reason)) {
        return null;
      }

      return null;
    }

    return typedPayload.success;
  } catch {
    return null;
  }
}

export async function restoreRemoteStore(authIdentity: AuthIdentity): Promise<StoreDataBundle | null> {
  const response = await requestRemote<RestoreStoreSuccess>('/api/store/restore', {
    authIdentity,
  });

  if (response === null || !response.found || response.bundle === null) {
    return null;
  }

  return response.bundle;
}

export async function setupRemoteOwnerStore(input: {
  authIdentity: AuthIdentity;
  storeName: string;
  ownerNickname: string;
  items: ChecklistItem[];
}): Promise<StoreDataBundle | null> {
  return requestRemote<StoreDataBundle>('/api/store/setup-owner', input);
}

export async function joinRemoteStoreWithInvite(input: {
  authIdentity: AuthIdentity;
  inviteCode: string;
  storeName: string;
  ownerNickname: string;
  nickname: string;
}): Promise<StoreDataBundle | null> {
  return requestRemote<StoreDataBundle>('/api/store/join-invite', input);
}

export async function syncRemoteStoreProfile(profile: StoreProfile): Promise<string | null> {
  const response = await requestRemote<SyncProfileSuccess>('/api/store/sync/profile', {
    profile,
  });

  return response?.storeId ?? null;
}

export async function syncRemoteWorkers(profile: StoreProfile, workers: Worker[]): Promise<void> {
  await requestRemote<{ synced: true }>('/api/store/sync/workers', {
    storeId: profile.storeId,
    workers,
  });
}

export async function syncRemoteItems(profile: StoreProfile, items: ChecklistItem[]): Promise<void> {
  await requestRemote<{ synced: true }>('/api/store/sync/items', {
    storeId: profile.storeId,
    items,
  });
}

export async function syncRemoteHistory(
  profile: StoreProfile,
  history: CompletionRecord[],
): Promise<void> {
  await requestRemote<{ synced: true }>('/api/store/sync/history', {
    profile,
    history,
  });
}
