import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { resolve } from 'node:path';
import {
  isSupabaseConfigured,
  joinStoreWithInvite,
  restoreStoreForAuth,
  setupOwnerStore,
  syncStoreHistory,
  syncStoreItems,
  syncStoreProfile,
  syncStoreWorkers,
} from './store-data-service.mjs';

const DEFAULT_PORT = 8787;
const COOKIE_NAME = 'store_checklist_toss_session';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const DEFAULT_TOSS_API_BASE_URL = 'https://apps-in-toss-api.toss.im';
const ENV_FILE_NAMES = ['.env.local', '.env'];
const sessions = new Map();

loadLocalEnvFiles();

const config = {
  port:
    Number.parseInt(process.env.PORT ?? process.env.TOSS_AUTH_SERVER_PORT ?? `${DEFAULT_PORT}`, 10) ||
    DEFAULT_PORT,
  host: process.env.TOSS_AUTH_SERVER_HOST?.trim() || '0.0.0.0',
  tossApiBaseUrl: process.env.TOSS_API_BASE_URL ?? DEFAULT_TOSS_API_BASE_URL,
  certPath: process.env.TOSS_MTLS_CERT_PATH?.trim() ?? '',
  keyPath: process.env.TOSS_MTLS_KEY_PATH?.trim() ?? '',
  caPath: process.env.TOSS_MTLS_CA_PATH?.trim() ?? '',
  allowedOrigin: process.env.TOSS_AUTH_ALLOWED_ORIGIN?.trim() ?? '',
  cookieSameSite: process.env.TOSS_AUTH_COOKIE_SAMESITE?.trim() || 'Lax',
  cookieSecure: process.env.TOSS_AUTH_COOKIE_SECURE === 'true',
};

function loadLocalEnvFiles() {
  for (const fileName of ENV_FILE_NAMES) {
    const absolutePath = resolve(process.cwd(), fileName);

    if (!existsSync(absolutePath)) {
      continue;
    }

    const content = readFileSync(absolutePath, 'utf8');
    const lines = content.split(/\r?\n/u);

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.length === 0 || trimmed.startsWith('#')) {
        continue;
      }

      const separatorIndex = trimmed.indexOf('=');

      if (separatorIndex < 0) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();

      if (key.length === 0 || process.env[key] !== undefined) {
        continue;
      }

      process.env[key] = rawValue.replace(/^['"]|['"]$/gu, '');
    }
  }
}

function createSuccess(success) {
  return { resultType: 'SUCCESS', success };
}

function createFailure(errorCode, reason) {
  return {
    resultType: 'FAIL',
    error: {
      errorCode,
      reason,
    },
  };
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(payload));
}

function parseScope(scope) {
  if (typeof scope !== 'string') {
    return [];
  }

  return scope
    .split(/[,\s]+/u)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function readCookieValue(request, name) {
  const cookieHeader = request.headers.cookie;

  if (typeof cookieHeader !== 'string') {
    return null;
  }

  const parts = cookieHeader.split(';');

  for (const part of parts) {
    const trimmed = part.trim();

    if (trimmed.startsWith(`${name}=`)) {
      return decodeURIComponent(trimmed.slice(name.length + 1));
    }
  }

  return null;
}

function writeSessionCookie(response, sessionId) {
  const attributes = ['Path=/', 'HttpOnly', `SameSite=${config.cookieSameSite}`];

  if (config.cookieSecure) {
    attributes.push('Secure');
  }

  const cookie =
    sessionId === null
      ? `${COOKIE_NAME}=; ${attributes.join('; ')}; Max-Age=0`
      : `${COOKIE_NAME}=${encodeURIComponent(sessionId)}; ${attributes.join('; ')}; Max-Age=${COOKIE_MAX_AGE_SECONDS}`;

  response.setHeader('Set-Cookie', cookie);
}

function applyCorsHeaders(request, response) {
  if (config.allowedOrigin.length === 0) {
    return;
  }

  const requestOrigin = request.headers.origin;

  if (typeof requestOrigin === 'string' && requestOrigin === config.allowedOrigin) {
    response.setHeader('Access-Control-Allow-Origin', config.allowedOrigin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    response.setHeader('Vary', 'Origin');
  }
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return null;
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

function getMtlsCredentials() {
  if (config.certPath.length === 0 || config.keyPath.length === 0) {
    return null;
  }

  const certPath = resolve(process.cwd(), config.certPath);
  const keyPath = resolve(process.cwd(), config.keyPath);
  const caPath = config.caPath.length > 0 ? resolve(process.cwd(), config.caPath) : '';

  if (!existsSync(certPath) || !existsSync(keyPath)) {
    return null;
  }

  return {
    cert: readFileSync(certPath, 'utf8'),
    key: readFileSync(keyPath, 'utf8'),
    ca: caPath.length > 0 && existsSync(caPath) ? readFileSync(caPath, 'utf8') : undefined,
  };
}

function tossRequest(pathname, options = {}) {
  const credentials = getMtlsCredentials();

  if (credentials === null) {
    return Promise.resolve({
      ok: false,
      statusCode: 503,
      payload: createFailure(
        'MTLS_NOT_CONFIGURED',
        'mTLS 인증서가 설정되지 않았어요. TOSS_MTLS_CERT_PATH 와 TOSS_MTLS_KEY_PATH 를 확인해 주세요.',
      ),
    });
  }

  const targetUrl = new URL(pathname, config.tossApiBaseUrl);
  const requestBody = options.body ?? null;

  return new Promise((resolvePromise) => {
    const request = httpsRequest(
      targetUrl,
      {
        method: options.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers ?? {}),
        },
        cert: credentials.cert,
        key: credentials.key,
        ca: credentials.ca,
        rejectUnauthorized: true,
      },
      (response) => {
        const chunks = [];

        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        response.on('end', () => {
          const rawText = Buffer.concat(chunks).toString('utf8');

          try {
            const payload = rawText.length > 0 ? JSON.parse(rawText) : createSuccess({});
            resolvePromise({
              ok: typeof response.statusCode === 'number' && response.statusCode >= 200 && response.statusCode < 300,
              statusCode: response.statusCode ?? 500,
              payload,
            });
          } catch {
            resolvePromise({
              ok: false,
              statusCode: response.statusCode ?? 500,
              payload: createFailure('INVALID_JSON', '토스 API 응답을 해석하지 못했어요.'),
            });
          }
        });
      },
    );

    request.on('error', (error) => {
      resolvePromise({
        ok: false,
        statusCode: 502,
        payload: createFailure(
          'TOSS_API_REQUEST_FAILED',
          error instanceof Error ? error.message : '토스 API 요청 중 오류가 발생했어요.',
        ),
      });
    });

    if (requestBody !== null) {
      request.write(JSON.stringify(requestBody));
    }

    request.end();
  });
}

async function handleLogin(request, response) {
  const body = await readJsonBody(request);

  if (
    body === null ||
    typeof body.authorizationCode !== 'string' ||
    (body.referrer !== 'DEFAULT' && body.referrer !== 'sandbox' && body.referrer !== 'SANDBOX')
  ) {
    sendJson(
      response,
      400,
      createFailure('INVALID_REQUEST', 'authorizationCode 와 referrer 를 올바르게 전달해 주세요.'),
    );
    return;
  }

  const tokenResult = await tossRequest('/api-partner/v1/apps-in-toss/user/oauth2/generate-token', {
    method: 'POST',
    body: {
      authorizationCode: body.authorizationCode,
      referrer: body.referrer,
    },
  });

  if (!tokenResult.ok) {
    sendJson(response, tokenResult.statusCode, tokenResult.payload);
    return;
  }

  const accessToken = tokenResult.payload?.success?.accessToken;

  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    sendJson(
      response,
      502,
      createFailure('INVALID_TOKEN_RESPONSE', '토큰 발급 응답에서 accessToken 을 찾지 못했어요.'),
    );
    return;
  }

  const loginMeResult = await tossRequest('/api-partner/v1/apps-in-toss/user/oauth2/login-me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!loginMeResult.ok) {
    sendJson(response, loginMeResult.statusCode, loginMeResult.payload);
    return;
  }

  const loginSuccess = loginMeResult.payload?.success ?? {};
  const authVerifiedAt = new Date().toISOString();
  const authSource = body.referrer === 'DEFAULT' ? 'toss' : 'sandbox';
  const sessionId = randomUUID();
  const tossUserKey =
    typeof loginSuccess.userKey === 'number' && Number.isFinite(loginSuccess.userKey)
      ? loginSuccess.userKey
      : null;
  const agreedScopes = parseScope(loginSuccess.scope);
  const agreedTerms = Array.isArray(loginSuccess.agreedTerms)
    ? loginSuccess.agreedTerms.filter((term) => typeof term === 'string')
    : [];

  sessions.set(sessionId, {
    accessToken,
    refreshToken:
      typeof tokenResult.payload?.success?.refreshToken === 'string'
        ? tokenResult.payload.success.refreshToken
        : null,
    authSource,
    tossUserKey,
    agreedScopes,
    agreedTerms,
    authVerifiedAt,
  });

  writeSessionCookie(response, sessionId);
  sendJson(
    response,
    200,
    createSuccess({
      authSource,
      tossUserKey,
      agreedScopes,
      agreedTerms,
      authVerifiedAt,
    }),
  );
}

async function handleLogout(request, response) {
  const sessionId = readCookieValue(request, COOKIE_NAME);
  const session = sessionId === null ? null : sessions.get(sessionId) ?? null;

  if (session !== null) {
    await tossRequest('/api-partner/v1/apps-in-toss/user/oauth2/access/remove-by-access-token', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    sessions.delete(sessionId);
  }

  writeSessionCookie(response, null);
  sendJson(response, 200, createSuccess({ revoked: true }));
}

async function handleRestoreStore(request, response) {
  if (!isSupabaseConfigured()) {
    sendJson(
      response,
      503,
      createFailure('SUPABASE_NOT_CONFIGURED', 'Supabase가 아직 설정되지 않았어요.'),
    );
    return;
  }

  const body = await readJsonBody(request);
  const result = await restoreStoreForAuth(body?.authIdentity);
  sendJson(response, 200, createSuccess(result));
}

async function handleSetupOwnerStore(request, response) {
  if (!isSupabaseConfigured()) {
    sendJson(
      response,
      503,
      createFailure('SUPABASE_NOT_CONFIGURED', 'Supabase가 아직 설정되지 않았어요.'),
    );
    return;
  }

  const body = await readJsonBody(request);
  const bundle = await setupOwnerStore(body);

  if (bundle === null) {
    sendJson(
      response,
      400,
      createFailure('INVALID_STORE_SETUP', '점주 매장 생성에 필요한 값을 확인해 주세요.'),
    );
    return;
  }

  sendJson(response, 200, createSuccess(bundle));
}

async function handleJoinStoreWithInvite(request, response) {
  if (!isSupabaseConfigured()) {
    sendJson(
      response,
      503,
      createFailure('SUPABASE_NOT_CONFIGURED', 'Supabase가 아직 설정되지 않았어요.'),
    );
    return;
  }

  const body = await readJsonBody(request);
  const bundle = await joinStoreWithInvite(body);

  if (bundle === null) {
    sendJson(
      response,
      404,
      createFailure('STORE_JOIN_FAILED', '초대 대상 매장을 찾지 못했어요.'),
    );
    return;
  }

  sendJson(response, 200, createSuccess(bundle));
}

async function handleSyncStoreProfile(request, response) {
  if (!isSupabaseConfigured()) {
    sendJson(
      response,
      503,
      createFailure('SUPABASE_NOT_CONFIGURED', 'Supabase가 아직 설정되지 않았어요.'),
    );
    return;
  }

  const body = await readJsonBody(request);
  const result = await syncStoreProfile(body);

  if (result === null) {
    sendJson(
      response,
      400,
      createFailure('INVALID_STORE_PROFILE', '매장 프로필 동기화 값이 올바르지 않아요.'),
    );
    return;
  }

  sendJson(response, 200, createSuccess(result));
}

async function handleSyncStoreWorkers(request, response) {
  if (!isSupabaseConfigured()) {
    sendJson(
      response,
      503,
      createFailure('SUPABASE_NOT_CONFIGURED', 'Supabase가 아직 설정되지 않았어요.'),
    );
    return;
  }

  const body = await readJsonBody(request);
  const result = await syncStoreWorkers(body);

  if (result === null) {
    sendJson(
      response,
      400,
      createFailure('INVALID_WORKERS_SYNC', '직원 목록 동기화 값이 올바르지 않아요.'),
    );
    return;
  }

  sendJson(response, 200, createSuccess(result));
}

async function handleSyncStoreItems(request, response) {
  if (!isSupabaseConfigured()) {
    sendJson(
      response,
      503,
      createFailure('SUPABASE_NOT_CONFIGURED', 'Supabase가 아직 설정되지 않았어요.'),
    );
    return;
  }

  const body = await readJsonBody(request);
  const result = await syncStoreItems(body);

  if (result === null) {
    sendJson(
      response,
      400,
      createFailure('INVALID_ITEMS_SYNC', '체크리스트 항목 동기화 값이 올바르지 않아요.'),
    );
    return;
  }

  sendJson(response, 200, createSuccess(result));
}

async function handleSyncStoreHistory(request, response) {
  if (!isSupabaseConfigured()) {
    sendJson(
      response,
      503,
      createFailure('SUPABASE_NOT_CONFIGURED', 'Supabase가 아직 설정되지 않았어요.'),
    );
    return;
  }

  const body = await readJsonBody(request);
  const result = await syncStoreHistory(body);

  if (result === null) {
    sendJson(
      response,
      400,
      createFailure('INVALID_HISTORY_SYNC', '기록 동기화 값이 올바르지 않아요.'),
    );
    return;
  }

  sendJson(response, 200, createSuccess(result));
}

function handleHealth(response) {
  const mtlsReady = getMtlsCredentials() !== null;

  sendJson(
    response,
    200,
    createSuccess({
      status: 'ok',
      mtlsReady,
      supabaseReady: isSupabaseConfigured(),
      tossApiBaseUrl: config.tossApiBaseUrl,
    }),
  );
}

const server = createServer((request, response) => {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  applyCorsHeaders(request, response);

  if (
    method === 'OPTIONS' &&
    (url.pathname.startsWith('/api/auth/toss/') || url.pathname.startsWith('/api/store/'))
  ) {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (method === 'GET' && url.pathname === '/healthz') {
    handleHealth(response);
    return;
  }

  if (method === 'POST' && url.pathname === '/api/auth/toss/login') {
    void handleLogin(request, response).catch((error) => {
      sendJson(
        response,
        500,
        createFailure(
          'INTERNAL_AUTH_SERVER_ERROR',
          error instanceof Error ? error.message : '토스 auth 서버 처리 중 오류가 발생했어요.',
        ),
      );
    });
    return;
  }

  if (method === 'POST' && url.pathname === '/api/auth/toss/logout') {
    void handleLogout(request, response).catch((error) => {
      sendJson(
        response,
        500,
        createFailure(
          'INTERNAL_AUTH_SERVER_ERROR',
          error instanceof Error ? error.message : '토스 auth 서버 처리 중 오류가 발생했어요.',
        ),
      );
    });
    return;
  }

  if (method === 'POST' && url.pathname === '/api/store/restore') {
    void handleRestoreStore(request, response).catch((error) => {
      sendJson(
        response,
        500,
        createFailure(
          'INTERNAL_STORE_SERVER_ERROR',
          error instanceof Error ? error.message : 'Supabase store 복원 중 오류가 발생했어요.',
        ),
      );
    });
    return;
  }

  if (method === 'POST' && url.pathname === '/api/store/setup-owner') {
    void handleSetupOwnerStore(request, response).catch((error) => {
      sendJson(
        response,
        500,
        createFailure(
          'INTERNAL_STORE_SERVER_ERROR',
          error instanceof Error ? error.message : 'Supabase owner setup 중 오류가 발생했어요.',
        ),
      );
    });
    return;
  }

  if (method === 'POST' && url.pathname === '/api/store/join-invite') {
    void handleJoinStoreWithInvite(request, response).catch((error) => {
      sendJson(
        response,
        500,
        createFailure(
          'INTERNAL_STORE_SERVER_ERROR',
          error instanceof Error ? error.message : 'Supabase invite join 중 오류가 발생했어요.',
        ),
      );
    });
    return;
  }

  if (method === 'POST' && url.pathname === '/api/store/sync/profile') {
    void handleSyncStoreProfile(request, response).catch((error) => {
      sendJson(
        response,
        500,
        createFailure(
          'INTERNAL_STORE_SERVER_ERROR',
          error instanceof Error ? error.message : 'Supabase profile sync 중 오류가 발생했어요.',
        ),
      );
    });
    return;
  }

  if (method === 'POST' && url.pathname === '/api/store/sync/workers') {
    void handleSyncStoreWorkers(request, response).catch((error) => {
      sendJson(
        response,
        500,
        createFailure(
          'INTERNAL_STORE_SERVER_ERROR',
          error instanceof Error ? error.message : 'Supabase workers sync 중 오류가 발생했어요.',
        ),
      );
    });
    return;
  }

  if (method === 'POST' && url.pathname === '/api/store/sync/items') {
    void handleSyncStoreItems(request, response).catch((error) => {
      sendJson(
        response,
        500,
        createFailure(
          'INTERNAL_STORE_SERVER_ERROR',
          error instanceof Error ? error.message : 'Supabase items sync 중 오류가 발생했어요.',
        ),
      );
    });
    return;
  }

  if (method === 'POST' && url.pathname === '/api/store/sync/history') {
    void handleSyncStoreHistory(request, response).catch((error) => {
      sendJson(
        response,
        500,
        createFailure(
          'INTERNAL_STORE_SERVER_ERROR',
          error instanceof Error ? error.message : 'Supabase history sync 중 오류가 발생했어요.',
        ),
      );
    });
    return;
  }

  sendJson(response, 404, createFailure('NOT_FOUND', '요청한 경로를 찾지 못했어요.'));
});

server.listen(config.port, config.host, () => {
  console.log(
    JSON.stringify({
      server: 'toss-auth-server',
      host: config.host,
      port: config.port,
      mtlsReady: getMtlsCredentials() !== null,
      supabaseReady: isSupabaseConfigured(),
      tossApiBaseUrl: config.tossApiBaseUrl,
      allowedOrigin: config.allowedOrigin,
    }),
  );
});
