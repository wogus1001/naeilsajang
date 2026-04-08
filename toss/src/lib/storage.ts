import { ChecklistItem, CompletionRecord, StoreDataBundle, StoreProfile, Worker } from '../types';

const STORAGE_KEYS = {
  profile: 'store_profile',
  workers: 'workers',
  items: 'checklist_items',
  history: 'completion_history',
} as const;

const LOCAL_STATE_REPLACED_EVENT = 'open-close-check:local-state-replaced';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

type LegacyStoreProfile = {
  storeName: string;
  ownerNickname: string;
  authCode?: string;
  createdAt: string;
};

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function normalizeHistoryRecord(value: unknown): CompletionRecord | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as Partial<CompletionRecord>;

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.date !== 'string' ||
    (candidate.type !== 'open' && candidate.type !== 'close') ||
    typeof candidate.completedAt !== 'string' ||
    typeof candidate.totalItems !== 'number' ||
    !Array.isArray(candidate.checkedItems) ||
    typeof candidate.workerId !== 'string'
  ) {
    return null;
  }

  return {
    id: candidate.id,
    date: candidate.date,
    type: candidate.type,
    completedAt: candidate.completedAt,
    totalItems: candidate.totalItems,
    checkedItems: candidate.checkedItems.filter((item): item is string => typeof item === 'string'),
    workerId: candidate.workerId,
    actorNameSnapshot:
      typeof candidate.actorNameSnapshot === 'string' ? candidate.actorNameSnapshot : null,
  };
}

function normalizeProfile(value: StoreProfile | LegacyStoreProfile | null): StoreProfile | null {
  if (value === null || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<StoreProfile> & LegacyStoreProfile;

  if (
    typeof candidate.storeName !== 'string' ||
    typeof candidate.ownerNickname !== 'string' ||
    typeof candidate.createdAt !== 'string'
  ) {
    return null;
  }

  const legacySource =
    typeof candidate.authCode === 'string' && candidate.authCode.startsWith('demo-')
      ? 'browser-demo'
      : 'toss';

  return {
    storeId: typeof candidate.storeId === 'string' ? candidate.storeId : null,
    storeName: candidate.storeName,
    ownerNickname: candidate.ownerNickname,
    memberNickname:
      typeof candidate.memberNickname === 'string' && candidate.memberNickname.trim().length > 0
        ? candidate.memberNickname
        : candidate.ownerNickname,
    membershipRole: candidate.membershipRole === 'staff' ? 'staff' : 'owner',
    memberWorkerId: typeof candidate.memberWorkerId === 'string' ? candidate.memberWorkerId : null,
    joinedWithInviteCode:
      typeof candidate.joinedWithInviteCode === 'string' ? candidate.joinedWithInviteCode : null,
    authSource:
      candidate.authSource === 'toss' ||
      candidate.authSource === 'sandbox' ||
      candidate.authSource === 'browser-demo'
        ? candidate.authSource
        : legacySource,
    tossUserKey: typeof candidate.tossUserKey === 'number' ? candidate.tossUserKey : null,
    agreedScopes: normalizeStringList(candidate.agreedScopes),
    agreedTerms: normalizeStringList(candidate.agreedTerms),
    authVerifiedAt:
      typeof candidate.authVerifiedAt === 'string' ? candidate.authVerifiedAt : candidate.createdAt,
    createdAt: candidate.createdAt,
  };
}

export function loadItems(): ChecklistItem[] {
  return readJson<ChecklistItem[]>(STORAGE_KEYS.items, []);
}

export function saveItems(items: ChecklistItem[]): void {
  writeJson(STORAGE_KEYS.items, items);
}

export function loadHistory(): CompletionRecord[] {
  const raw = readJson<unknown[]>(STORAGE_KEYS.history, []);
  return raw
    .map((record) => normalizeHistoryRecord(record))
    .filter((record): record is CompletionRecord => record !== null);
}

export function saveHistory(records: CompletionRecord[]): void {
  writeJson(STORAGE_KEYS.history, records);
}

export function loadProfile(): StoreProfile | null {
  const profile = readJson<StoreProfile | LegacyStoreProfile | null>(STORAGE_KEYS.profile, null);
  return normalizeProfile(profile);
}

export function saveProfile(profile: StoreProfile): void {
  writeJson(STORAGE_KEYS.profile, profile);
}

export function clearProfile(): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEYS.profile);
}

export function loadWorkers(): Worker[] {
  return readJson<Worker[]>(STORAGE_KEYS.workers, []);
}

export function saveWorkers(workers: Worker[]): void {
  writeJson(STORAGE_KEYS.workers, workers);
}

export function clearLocalStoreBundle(): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEYS.profile);
  window.localStorage.removeItem(STORAGE_KEYS.workers);
  window.localStorage.removeItem(STORAGE_KEYS.items);
  window.localStorage.removeItem(STORAGE_KEYS.history);
  dispatchLocalStateReplaced();
}

function dispatchLocalStateReplaced(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(LOCAL_STATE_REPLACED_EVENT));
}

export function replaceLocalStoreBundle(bundle: StoreDataBundle): void {
  saveProfile(bundle.profile);
  saveWorkers(bundle.workers);
  saveItems(bundle.items);
  saveHistory(bundle.history);
  dispatchLocalStateReplaced();
}

export function subscribeToLocalStateReplaced(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handler = (): void => {
    listener();
  };

  window.addEventListener(LOCAL_STATE_REPLACED_EVENT, handler);

  return () => {
    window.removeEventListener(LOCAL_STATE_REPLACED_EVENT, handler);
  };
}
