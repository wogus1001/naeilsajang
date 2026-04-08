import type { StoreInvitePayload } from '../types';

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return globalThis.btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

function fromBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/gu, '+').replace(/_/gu, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const binary = globalThis.atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function createStoreInviteCode(input: {
  storeName: string;
  ownerNickname: string;
  issuedAt?: string;
}): string {
  const payload: StoreInvitePayload = {
    version: 1,
    storeName: input.storeName.trim(),
    ownerNickname: input.ownerNickname.trim(),
    issuedAt: input.issuedAt ?? new Date().toISOString(),
  };

  return toBase64Url(JSON.stringify(payload));
}

export function parseStoreInviteCode(code: string): StoreInvitePayload | null {
  const decoded = fromBase64Url(code.trim());

  if (decoded === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(decoded);

    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const candidate = parsed as Partial<StoreInvitePayload>;

    if (
      candidate.version !== 1 ||
      typeof candidate.storeName !== 'string' ||
      typeof candidate.ownerNickname !== 'string' ||
      typeof candidate.issuedAt !== 'string'
    ) {
      return null;
    }

    if (candidate.storeName.trim().length === 0 || candidate.ownerNickname.trim().length === 0) {
      return null;
    }

    return {
      version: 1,
      storeName: candidate.storeName.trim(),
      ownerNickname: candidate.ownerNickname.trim(),
      issuedAt: candidate.issuedAt,
    };
  } catch {
    return null;
  }
}

export function buildStoreInviteLoginUrl(code: string): string {
  if (typeof window === 'undefined') {
    return `/login?invite=${encodeURIComponent(code)}`;
  }

  return `${window.location.origin}/login?invite=${encodeURIComponent(code)}`;
}
