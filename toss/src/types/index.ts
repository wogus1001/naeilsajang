export interface ChecklistItem {
  id: string;
  label: string;
  type: 'open' | 'close';
  order: number;
}

export interface CompletionRecord {
  id: string;
  date: string;
  type: 'open' | 'close';
  completedAt: string;
  totalItems: number;
  checkedItems: string[];
  workerId: string;
  actorNameSnapshot: string | null;
}

export type AuthSource = 'toss' | 'sandbox' | 'browser-demo';
export type MembershipRole = 'owner' | 'staff';

export interface AuthIdentity {
  authSource: AuthSource;
  tossUserKey: number | null;
  agreedScopes: string[];
  agreedTerms: string[];
  authVerifiedAt: string;
}

export interface VerifiedTossAuthIdentity extends AuthIdentity {
  authSource: 'toss' | 'sandbox';
  tossUserKey: number;
}

export interface StoreProfile {
  storeId: string | null;
  storeName: string;
  ownerNickname: string;
  memberNickname: string;
  membershipRole: MembershipRole;
  memberWorkerId: string | null;
  joinedWithInviteCode: string | null;
  authSource: AuthSource;
  tossUserKey: number | null;
  agreedScopes: string[];
  agreedTerms: string[];
  authVerifiedAt: string;
  createdAt: string;
}

export interface Worker {
  id: string;
  name: string;
  addedAt: string;
}

export interface StreakInfo {
  current: number;
  longest: number;
}

export type ChecklistType = 'open' | 'close';

export interface ActorOption {
  id: string;
  name: string;
  kind: 'owner' | 'worker';
}

export interface StoreInvitePayload {
  version: 1;
  storeName: string;
  ownerNickname: string;
  issuedAt: string;
}

export interface StoreDataBundle {
  profile: StoreProfile;
  workers: Worker[];
  items: ChecklistItem[];
  history: CompletionRecord[];
}
