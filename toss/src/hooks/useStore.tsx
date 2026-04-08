import { createContext, useContext, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { appLogin } from '@apps-in-toss/web-framework';
import { nanoid } from 'nanoid';
import { useNavigate } from 'react-router-dom';
import { createDefaultChecklistItems } from '../lib/defaults';
import {
  joinRemoteStoreWithInvite,
  restoreRemoteStore,
  setupRemoteOwnerStore,
  syncRemoteStoreProfile,
} from '../lib/remoteStore';
import { exchangeTossAuthorizationCode, revokeTossServerSession } from '../lib/tossAuth';
import {
  clearLocalStoreBundle,
  loadHistory,
  loadItems,
  loadProfile,
  loadWorkers,
  replaceLocalStoreBundle,
  saveProfile,
} from '../lib/storage';
import { AuthIdentity, MembershipRole, StoreProfile, VerifiedTossAuthIdentity } from '../types';

interface SetupStoreInput {
  storeName: string;
  ownerNickname: string;
  memberNickname: string;
  membershipRole: MembershipRole;
  joinedWithInviteCode?: string | null;
}

interface StoreContextValue {
  profile: StoreProfile | null;
  isLoggedIn: boolean;
  isLoggingIn: boolean;
  loginError: string | null;
  pendingAuthIdentity: AuthIdentity | null;
  login: (nextPath?: string) => Promise<void>;
  setupStore: (input: SetupStoreInput) => Promise<void>;
  logout: () => void;
}

const PENDING_AUTH_IDENTITY_KEY = 'pending_auth_identity';
const StoreContext = createContext<StoreContextValue | null>(null);

interface TossLoginResult {
  authorizationCode: string;
  referrer: 'DEFAULT' | 'sandbox' | 'SANDBOX';
}

function readSession(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage.getItem(key);
}

function writeSession(key: string, value: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (value === null) {
    window.sessionStorage.removeItem(key);
    return;
  }

  window.sessionStorage.setItem(key, value);
}

function normalizePendingAuthIdentity(raw: string | null): AuthIdentity | null {
  if (raw === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const candidate = parsed as Partial<AuthIdentity>;

    if (
      candidate.authSource !== 'toss' &&
      candidate.authSource !== 'sandbox' &&
      candidate.authSource !== 'browser-demo'
    ) {
      return null;
    }

    if (typeof candidate.authVerifiedAt !== 'string') {
      return null;
    }

    return {
      authSource: candidate.authSource,
      tossUserKey: typeof candidate.tossUserKey === 'number' ? candidate.tossUserKey : null,
      agreedScopes: Array.isArray(candidate.agreedScopes)
        ? candidate.agreedScopes.filter((scope): scope is string => typeof scope === 'string')
        : [],
      agreedTerms: Array.isArray(candidate.agreedTerms)
        ? candidate.agreedTerms.filter((term): term is string => typeof term === 'string')
        : [],
      authVerifiedAt: candidate.authVerifiedAt,
    };
  } catch {
    return null;
  }
}

function writePendingAuthIdentity(identity: AuthIdentity | null): void {
  writeSession(PENDING_AUTH_IDENTITY_KEY, identity === null ? null : JSON.stringify(identity));
}

function createBrowserDemoIdentity(): AuthIdentity {
  return {
    authSource: 'browser-demo',
    tossUserKey: null,
    agreedScopes: [],
    agreedTerms: [],
    authVerifiedAt: new Date().toISOString(),
  };
}

function isBridgeUnavailableError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('ReactNativeWebView is not available in browser environment')
  );
}

function getLoginErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return '토스 로그인 연결 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

interface StoreProviderProps {
  children: ReactNode;
}

export function StoreProvider({ children }: StoreProviderProps): ReactElement {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StoreProfile | null>(() => loadProfile());
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pendingAuthIdentity, setPendingAuthIdentity] = useState<AuthIdentity | null>(() =>
    normalizePendingAuthIdentity(readSession(PENDING_AUTH_IDENTITY_KEY)),
  );

  async function login(nextPath: string = '/setup'): Promise<void> {
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const { authorizationCode, referrer }: TossLoginResult = await appLogin();
      const verifiedIdentity: VerifiedTossAuthIdentity = await exchangeTossAuthorizationCode({
        authorizationCode,
        referrer,
      });
      const restoredBundle = await restoreRemoteStore(verifiedIdentity);

      if (restoredBundle !== null) {
        replaceLocalStoreBundle(restoredBundle);
        writePendingAuthIdentity(null);
        setPendingAuthIdentity(null);
        setProfile(restoredBundle.profile);
        setLoginError(null);
        navigate('/');
        return;
      }

      setPendingAuthIdentity(verifiedIdentity);
      writePendingAuthIdentity(verifiedIdentity);
      navigate(nextPath);
      return;
    } catch (error) {
      if (isBridgeUnavailableError(error)) {
        const fallbackIdentity = createBrowserDemoIdentity();
        setPendingAuthIdentity(fallbackIdentity);
        writePendingAuthIdentity(fallbackIdentity);
        navigate(nextPath);
        return;
      }

      setLoginError(getLoginErrorMessage(error));
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function setupStore(input: SetupStoreInput): Promise<void> {
    const authIdentity =
      pendingAuthIdentity ?? {
        ...createBrowserDemoIdentity(),
        authVerifiedAt: new Date().toISOString(),
      };
    const membershipRole: MembershipRole = input.membershipRole;
    const ownerNickname = input.ownerNickname.trim();
    const memberNickname =
      membershipRole === 'owner' ? ownerNickname : input.memberNickname.trim();
    const memberWorkerId = membershipRole === 'staff' ? nanoid() : null;

    const storeName = input.storeName.trim();
    const fallbackProfile: StoreProfile = {
      storeId: null,
      storeName,
      ownerNickname,
      memberNickname,
      membershipRole,
      memberWorkerId,
      joinedWithInviteCode: input.joinedWithInviteCode ?? null,
      authSource: authIdentity.authSource,
      tossUserKey: authIdentity.tossUserKey,
      agreedScopes: authIdentity.agreedScopes,
      agreedTerms: authIdentity.agreedTerms,
      authVerifiedAt: authIdentity.authVerifiedAt,
      createdAt: new Date().toISOString(),
    };

    const remoteBundle =
      membershipRole === 'owner'
        ? await setupRemoteOwnerStore({
            authIdentity,
            storeName,
            ownerNickname,
            items: createDefaultChecklistItems(),
          })
        : input.joinedWithInviteCode
          ? await joinRemoteStoreWithInvite({
              authIdentity,
              inviteCode: input.joinedWithInviteCode,
              storeName,
              ownerNickname,
              nickname: memberNickname,
            })
          : null;

    if (remoteBundle !== null) {
      replaceLocalStoreBundle(remoteBundle);
    } else {
      replaceLocalStoreBundle({
        profile: fallbackProfile,
        workers: membershipRole === 'owner' ? [] : loadWorkers(),
        items: membershipRole === 'owner' ? createDefaultChecklistItems() : loadItems(),
        history: membershipRole === 'owner' ? [] : loadHistory(),
      });
    }

    writePendingAuthIdentity(null);
    setPendingAuthIdentity(null);
    setProfile(remoteBundle?.profile ?? fallbackProfile);
    setLoginError(null);
    navigate('/');
  }

  function logout(): void {
    clearLocalStoreBundle();
    writePendingAuthIdentity(null);
    setPendingAuthIdentity(null);
    setProfile(null);
    setLoginError(null);
    void revokeTossServerSession();
    navigate('/login');
  }

  useEffect(() => {
    if (profile === null) {
      return;
    }

    let cancelled = false;

    void syncRemoteStoreProfile(profile).then((storeId) => {
      if (cancelled || storeId === null || profile.storeId === storeId) {
        return;
      }

      const nextProfile: StoreProfile = {
        ...profile,
        storeId,
      };

      saveProfile(nextProfile);
      setProfile(nextProfile);
    });

    return () => {
      cancelled = true;
    };
  }, [profile]);

  return (
    <StoreContext.Provider
      value={{
        profile,
        isLoggedIn: profile !== null,
        isLoggingIn,
        loginError,
        pendingAuthIdentity,
        login,
        setupStore,
        logout,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext);

  if (context === null) {
    throw new Error('useStore must be used within a StoreProvider');
  }

  return context;
}
