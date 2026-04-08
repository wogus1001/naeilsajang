import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

let supabaseAdminClient = null;

function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL?.trim() ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '',
  };
}

export function isSupabaseConfigured() {
  const config = getSupabaseConfig();
  return config.url.length > 0 && config.serviceRoleKey.length > 0;
}

function getSupabaseAdmin() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (supabaseAdminClient !== null) {
    return supabaseAdminClient;
  }

  const config = getSupabaseConfig();
  supabaseAdminClient = createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseAdminClient;
}

function formatTimestamp(value) {
  return typeof value === 'string' && value.length > 0 ? value : new Date().toISOString();
}

function formatInFilter(values) {
  return `(${values.map((value) => `"${String(value).replace(/"/gu, '\\"')}"`).join(',')})`;
}

function normalizeChecklistItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item) => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : '',
      label: typeof item.label === 'string' ? item.label.trim() : '',
      type: item.type === 'open' || item.type === 'close' ? item.type : 'open',
      order: typeof item.order === 'number' ? item.order : 0,
    }))
    .filter((item) => item.id.length > 0 && item.label.length > 0 && item.order > 0);
}

function normalizeWorkers(workers) {
  if (!Array.isArray(workers)) {
    return [];
  }

  return workers
    .filter((worker) => typeof worker === 'object' && worker !== null)
    .map((worker) => ({
      id: typeof worker.id === 'string' ? worker.id : '',
      name: typeof worker.name === 'string' ? worker.name.trim() : '',
      addedAt: formatTimestamp(worker.addedAt),
    }))
    .filter((worker) => worker.id.length > 0 && worker.name.length > 0);
}

function normalizeHistory(records) {
  if (!Array.isArray(records)) {
    return [];
  }

  return records
    .filter((record) => typeof record === 'object' && record !== null)
    .map((record) => ({
      id: typeof record.id === 'string' ? record.id : '',
      date: typeof record.date === 'string' ? record.date : '',
      type: record.type === 'open' || record.type === 'close' ? record.type : 'open',
      completedAt: formatTimestamp(record.completedAt),
      totalItems: typeof record.totalItems === 'number' ? record.totalItems : 0,
      checkedItems: Array.isArray(record.checkedItems)
        ? record.checkedItems.filter((item) => typeof item === 'string')
        : [],
      workerId: typeof record.workerId === 'string' ? record.workerId : 'owner',
      actorNameSnapshot:
        typeof record.actorNameSnapshot === 'string' && record.actorNameSnapshot.trim().length > 0
          ? record.actorNameSnapshot.trim()
          : null,
    }))
    .filter((record) => record.id.length > 0 && record.date.length > 0);
}

function buildProfile(storeRow, membershipRow) {
  const membershipRole =
    membershipRow?.role === 'staff' ? 'staff' : 'owner';
  const memberNickname =
    typeof membershipRow?.nickname === 'string' && membershipRow.nickname.trim().length > 0
      ? membershipRow.nickname
      : storeRow.owner_nickname;

  return {
    storeId: storeRow.id,
    storeName: storeRow.store_name,
    ownerNickname: storeRow.owner_nickname,
    memberNickname,
    membershipRole,
    memberWorkerId: typeof membershipRow?.worker_id === 'string' ? membershipRow.worker_id : null,
    joinedWithInviteCode: null,
    authSource: storeRow.auth_source,
    tossUserKey: typeof storeRow.toss_user_key === 'number' ? storeRow.toss_user_key : null,
    agreedScopes: Array.isArray(storeRow.agreed_scopes) ? storeRow.agreed_scopes : [],
    agreedTerms: Array.isArray(storeRow.agreed_terms) ? storeRow.agreed_terms : [],
    authVerifiedAt: formatTimestamp(storeRow.auth_verified_at),
    createdAt: formatTimestamp(storeRow.created_at),
  };
}

async function assertNoError(result, label) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data;
}

async function fetchStoreBundleByStoreId(storeId, membershipRow = null) {
  const supabase = getSupabaseAdmin();

  if (supabase === null) {
    return null;
  }

  const storeRow = await assertNoError(
    await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .maybeSingle(),
    'stores 조회 실패',
  );

  if (storeRow === null) {
    return null;
  }

  const workers = await assertNoError(
    await supabase
      .from('workers')
      .select('id,name,added_at')
      .eq('store_id', storeId)
      .is('archived_at', null)
      .order('added_at', { ascending: true }),
    'workers 조회 실패',
  );

  const items = await assertNoError(
    await supabase
      .from('checklist_items')
      .select('id,label,type,sort_order')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('type', { ascending: true })
      .order('sort_order', { ascending: true }),
    'checklist_items 조회 실패',
  );

  const history = await assertNoError(
    await supabase
      .from('completion_records')
      .select('id,record_date,checklist_type,completed_at,total_items,checked_item_ids,actor_worker_id,actor_name_snapshot')
      .eq('store_id', storeId)
      .order('record_date', { ascending: false })
      .order('completed_at', { ascending: false }),
    'completion_records 조회 실패',
  );

  return {
    profile: buildProfile(storeRow, membershipRow),
    workers: Array.isArray(workers)
      ? workers.map((worker) => ({
          id: worker.id,
          name: worker.name,
          addedAt: formatTimestamp(worker.added_at),
        }))
      : [],
    items: Array.isArray(items)
      ? items.map((item) => ({
          id: item.id,
          label: item.label,
          type: item.type,
          order: item.sort_order,
        }))
      : [],
    history: Array.isArray(history)
      ? history.map((record) => ({
          id: record.id,
          date: record.record_date,
          type: record.checklist_type,
          completedAt: formatTimestamp(record.completed_at),
          totalItems: record.total_items,
          checkedItems: Array.isArray(record.checked_item_ids) ? record.checked_item_ids : [],
          workerId:
            typeof record.actor_worker_id === 'string' && record.actor_worker_id.length > 0
              ? record.actor_worker_id
              : 'owner',
          actorNameSnapshot:
            typeof record.actor_name_snapshot === 'string' && record.actor_name_snapshot.length > 0
              ? record.actor_name_snapshot
              : null,
        }))
      : [],
  };
}

async function ensureOwnerMembership(storeId, authIdentity, ownerNickname) {
  const supabase = getSupabaseAdmin();

  if (
    supabase === null ||
    typeof authIdentity?.tossUserKey !== 'number' ||
    !Number.isFinite(authIdentity.tossUserKey)
  ) {
    return;
  }

  await assertNoError(
    await supabase.from('store_memberships').upsert(
      {
        store_id: storeId,
        toss_user_key: authIdentity.tossUserKey,
        role: 'owner',
        nickname: ownerNickname,
        worker_id: null,
      },
      {
        onConflict: 'store_id,toss_user_key',
      },
    ),
    'owner membership 저장 실패',
  );
}

async function upsertItemsForStore(storeId, items) {
  const supabase = getSupabaseAdmin();

  if (supabase === null) {
    return;
  }

  const normalizedItems = normalizeChecklistItems(items);

  if (normalizedItems.length > 0) {
    await assertNoError(
      await supabase.from('checklist_items').upsert(
        normalizedItems.map((item) => ({
          id: item.id,
          store_id: storeId,
          label: item.label,
          type: item.type,
          sort_order: item.order,
          is_active: true,
        })),
        {
          onConflict: 'id',
        },
      ),
      'checklist_items 저장 실패',
    );
  }

  if (normalizedItems.length === 0) {
    await assertNoError(
      await supabase
        .from('checklist_items')
        .update({ is_active: false })
        .eq('store_id', storeId),
      'checklist_items 비활성화 실패',
    );
    return;
  }

  await assertNoError(
    await supabase
      .from('checklist_items')
      .update({ is_active: false })
      .eq('store_id', storeId)
      .not('id', 'in', formatInFilter(normalizedItems.map((item) => item.id))),
    '누락된 checklist_items 비활성화 실패',
  );
}

async function upsertWorkersForStore(storeId, workers) {
  const supabase = getSupabaseAdmin();

  if (supabase === null) {
    return;
  }

  const normalizedWorkers = normalizeWorkers(workers);

  if (normalizedWorkers.length > 0) {
    await assertNoError(
      await supabase.from('workers').upsert(
        normalizedWorkers.map((worker) => ({
          id: worker.id,
          store_id: storeId,
          name: worker.name,
          added_at: worker.addedAt,
          archived_at: null,
        })),
        {
          onConflict: 'id',
        },
      ),
      'workers 저장 실패',
    );
  }

  if (normalizedWorkers.length === 0) {
    await assertNoError(
      await supabase
        .from('workers')
        .update({ archived_at: new Date().toISOString() })
        .eq('store_id', storeId),
      'workers 보관 처리 실패',
    );
    return;
  }

  await assertNoError(
    await supabase
      .from('workers')
      .update({ archived_at: new Date().toISOString() })
      .eq('store_id', storeId)
      .not('id', 'in', formatInFilter(normalizedWorkers.map((worker) => worker.id))),
    '누락된 workers 보관 처리 실패',
  );
}

async function upsertHistoryForStore(storeId, profile, history) {
  const supabase = getSupabaseAdmin();

  if (supabase === null) {
    return;
  }

  const normalizedHistory = normalizeHistory(history);

  if (normalizedHistory.length === 0) {
    return;
  }

  await assertNoError(
    await supabase.from('completion_records').upsert(
      normalizedHistory.map((record) => ({
        id: record.id,
        store_id: storeId,
        record_date: record.date,
        checklist_type: record.type,
        completed_at: record.completedAt,
        total_items: record.totalItems,
        checked_item_ids: record.checkedItems,
        actor_kind: record.workerId === 'owner' ? 'owner' : 'worker',
        actor_worker_id: record.workerId === 'owner' ? null : record.workerId,
        actor_name_snapshot:
          record.actorNameSnapshot ?? (record.workerId === 'owner' ? profile.ownerNickname : '삭제된 직원'),
      })),
      {
        onConflict: 'id',
      },
    ),
    'completion_records 저장 실패',
  );
}

async function findStoreForProfile(profile) {
  const supabase = getSupabaseAdmin();

  if (supabase === null || typeof profile !== 'object' || profile === null) {
    return null;
  }

  if (typeof profile.storeId === 'string' && profile.storeId.length > 0) {
    const store = await assertNoError(
      await supabase
        .from('stores')
        .select('*')
        .eq('id', profile.storeId)
        .maybeSingle(),
      'stores 조회 실패',
    );

    if (store !== null) {
      return store;
    }
  }

  if (typeof profile.tossUserKey === 'number' && Number.isFinite(profile.tossUserKey)) {
    const store = await assertNoError(
      await supabase
        .from('stores')
        .select('*')
        .eq('toss_user_key', profile.tossUserKey)
        .maybeSingle(),
      'stores 조회 실패',
    );

    if (store !== null) {
      return store;
    }
  }

  if (typeof profile.storeName === 'string' && typeof profile.ownerNickname === 'string') {
    return assertNoError(
      await supabase
        .from('stores')
        .select('*')
        .eq('store_name', profile.storeName)
        .eq('owner_nickname', profile.ownerNickname)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      'stores 조회 실패',
    );
  }

  return null;
}

export async function restoreStoreForAuth(authIdentity) {
  const supabase = getSupabaseAdmin();

  if (
    supabase === null ||
    typeof authIdentity !== 'object' ||
    authIdentity === null ||
    typeof authIdentity.tossUserKey !== 'number' ||
    !Number.isFinite(authIdentity.tossUserKey)
  ) {
    return { found: false, bundle: null };
  }

  const membership = await assertNoError(
    await supabase
      .from('store_memberships')
      .select('*')
      .eq('toss_user_key', authIdentity.tossUserKey)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    'membership 조회 실패',
  );

  if (membership !== null) {
    const bundle = await fetchStoreBundleByStoreId(membership.store_id, membership);
    return { found: bundle !== null, bundle };
  }

  const ownerStore = await assertNoError(
    await supabase
      .from('stores')
      .select('*')
      .eq('toss_user_key', authIdentity.tossUserKey)
      .maybeSingle(),
    'owner store 조회 실패',
  );

  if (ownerStore === null) {
    return { found: false, bundle: null };
  }

  const bundle = await fetchStoreBundleByStoreId(ownerStore.id, null);
  return { found: bundle !== null, bundle };
}

export async function setupOwnerStore(input) {
  const supabase = getSupabaseAdmin();

  if (
    supabase === null ||
    typeof input !== 'object' ||
    input === null ||
    typeof input.storeName !== 'string' ||
    typeof input.ownerNickname !== 'string'
  ) {
    return null;
  }

  const authIdentity = input.authIdentity ?? null;
  const storeName = input.storeName.trim();
  const ownerNickname = input.ownerNickname.trim();

  if (storeName.length === 0 || ownerNickname.length === 0) {
    return null;
  }

  let storeRow =
    authIdentity && typeof authIdentity.tossUserKey === 'number' && Number.isFinite(authIdentity.tossUserKey)
      ? await assertNoError(
          await supabase
            .from('stores')
            .select('*')
            .eq('toss_user_key', authIdentity.tossUserKey)
            .maybeSingle(),
          'stores 조회 실패',
        )
      : null;

  if (storeRow === null) {
    storeRow = await assertNoError(
      await supabase
        .from('stores')
        .insert({
          toss_user_key:
            authIdentity && typeof authIdentity.tossUserKey === 'number' ? authIdentity.tossUserKey : null,
          store_name: storeName,
          owner_nickname: ownerNickname,
          auth_source: authIdentity?.authSource ?? 'browser-demo',
          agreed_scopes: Array.isArray(authIdentity?.agreedScopes) ? authIdentity.agreedScopes : [],
          agreed_terms: Array.isArray(authIdentity?.agreedTerms) ? authIdentity.agreedTerms : [],
          auth_verified_at: formatTimestamp(authIdentity?.authVerifiedAt),
        })
        .select('*')
        .single(),
      'store 생성 실패',
    );
  } else {
    storeRow = await assertNoError(
      await supabase
        .from('stores')
        .update({
          store_name: storeName,
          owner_nickname: ownerNickname,
          auth_source: authIdentity?.authSource ?? storeRow.auth_source,
          agreed_scopes: Array.isArray(authIdentity?.agreedScopes) ? authIdentity.agreedScopes : storeRow.agreed_scopes,
          agreed_terms: Array.isArray(authIdentity?.agreedTerms) ? authIdentity.agreedTerms : storeRow.agreed_terms,
          auth_verified_at: formatTimestamp(authIdentity?.authVerifiedAt),
        })
        .eq('id', storeRow.id)
        .select('*')
        .single(),
      'store 업데이트 실패',
    );
  }

  await ensureOwnerMembership(storeRow.id, authIdentity, ownerNickname);
  await upsertItemsForStore(storeRow.id, input.items);

  return fetchStoreBundleByStoreId(storeRow.id, {
    role: 'owner',
    nickname: ownerNickname,
    worker_id: null,
  });
}

export async function joinStoreWithInvite(input) {
  const supabase = getSupabaseAdmin();

  if (
    supabase === null ||
    typeof input !== 'object' ||
    input === null ||
    typeof input.storeName !== 'string' ||
    typeof input.ownerNickname !== 'string' ||
    typeof input.nickname !== 'string' ||
    typeof input.authIdentity?.tossUserKey !== 'number'
  ) {
    return null;
  }

  const storeName = input.storeName.trim();
  const ownerNickname = input.ownerNickname.trim();
  const nickname = input.nickname.trim();

  if (storeName.length === 0 || ownerNickname.length === 0 || nickname.length === 0) {
    return null;
  }

  const storeRow = await assertNoError(
    await supabase
      .from('stores')
      .select('*')
      .eq('store_name', storeName)
      .eq('owner_nickname', ownerNickname)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    '초대 대상 매장 조회 실패',
  );

  if (storeRow === null) {
    return null;
  }

  const existingMembership = await assertNoError(
    await supabase
      .from('store_memberships')
      .select('*')
      .eq('store_id', storeRow.id)
      .eq('toss_user_key', input.authIdentity.tossUserKey)
      .maybeSingle(),
    'existing membership 조회 실패',
  );

  const workerId =
    typeof existingMembership?.worker_id === 'string' && existingMembership.worker_id.length > 0
      ? existingMembership.worker_id
      : randomUUID();

  await assertNoError(
    await supabase.from('workers').upsert(
      {
        id: workerId,
        store_id: storeRow.id,
        name: nickname,
        added_at: new Date().toISOString(),
        archived_at: null,
      },
      {
        onConflict: 'id',
      },
    ),
    '직원 worker 저장 실패',
  );

  const membership = await assertNoError(
    await supabase.from('store_memberships').upsert(
      {
        store_id: storeRow.id,
        toss_user_key: input.authIdentity.tossUserKey,
        role: 'staff',
        nickname,
        worker_id: workerId,
      },
      {
        onConflict: 'store_id,toss_user_key',
      },
    ).select('*').single(),
    '직원 membership 저장 실패',
  );

  return fetchStoreBundleByStoreId(storeRow.id, membership);
}

export async function syncStoreProfile(input) {
  const supabase = getSupabaseAdmin();

  if (supabase === null || typeof input?.profile !== 'object' || input.profile === null) {
    return null;
  }

  const profile = input.profile;
  const existingStore = await findStoreForProfile(profile);
  let storeRow = existingStore;

  if (storeRow === null) {
    storeRow = await assertNoError(
      await supabase
        .from('stores')
        .insert({
          toss_user_key:
            typeof profile.tossUserKey === 'number' && Number.isFinite(profile.tossUserKey)
              ? profile.tossUserKey
              : null,
          store_name: profile.storeName,
          owner_nickname: profile.ownerNickname,
          auth_source: profile.authSource,
          agreed_scopes: profile.agreedScopes,
          agreed_terms: profile.agreedTerms,
          auth_verified_at: formatTimestamp(profile.authVerifiedAt),
          created_at: formatTimestamp(profile.createdAt),
        })
        .select('*')
        .single(),
      'store 생성 실패',
    );
  } else {
    storeRow = await assertNoError(
      await supabase
        .from('stores')
        .update({
          store_name: profile.storeName,
          owner_nickname: profile.ownerNickname,
          toss_user_key:
            typeof profile.tossUserKey === 'number' && Number.isFinite(profile.tossUserKey)
              ? profile.tossUserKey
              : storeRow.toss_user_key,
          auth_source: profile.authSource,
          agreed_scopes: profile.agreedScopes,
          agreed_terms: profile.agreedTerms,
          auth_verified_at: formatTimestamp(profile.authVerifiedAt),
        })
        .eq('id', storeRow.id)
        .select('*')
        .single(),
      'store 업데이트 실패',
    );
  }

  if (typeof profile.tossUserKey === 'number' && Number.isFinite(profile.tossUserKey)) {
    await assertNoError(
      await supabase.from('store_memberships').upsert(
        {
          store_id: storeRow.id,
          toss_user_key: profile.tossUserKey,
          role: profile.membershipRole,
          nickname: profile.memberNickname,
          worker_id: profile.memberWorkerId,
        },
        {
          onConflict: 'store_id,toss_user_key',
        },
      ),
      'membership 동기화 실패',
    );
  }

  return { storeId: storeRow.id };
}

export async function syncStoreWorkers(input) {
  if (typeof input?.storeId !== 'string' || input.storeId.length === 0) {
    return null;
  }

  await upsertWorkersForStore(input.storeId, input.workers);
  return { synced: true };
}

export async function syncStoreItems(input) {
  if (typeof input?.storeId !== 'string' || input.storeId.length === 0) {
    return null;
  }

  await upsertItemsForStore(input.storeId, input.items);
  return { synced: true };
}

export async function syncStoreHistory(input) {
  if (typeof input?.profile !== 'object' || input.profile === null) {
    return null;
  }

  const storeRow = await findStoreForProfile(input.profile);

  if (storeRow === null) {
    return null;
  }

  await upsertHistoryForStore(storeRow.id, input.profile, input.history);
  return { synced: true };
}
