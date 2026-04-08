import { useState, type FormEvent, type ReactElement } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { parseStoreInviteCode } from '../lib/inviteCode';
import { useStore } from '../hooks/useStore';
import { AuthSource } from '../types';

function getAuthSourceLabel(source: AuthSource): string {
  switch (source) {
    case 'toss':
      return '실제 Toss 로그인';
    case 'sandbox':
      return 'Toss Sandbox 로그인';
    case 'browser-demo':
      return '브라우저 데모 로그인';
    default:
      return '로그인 필요';
  }
}

export function SetupPage(): ReactElement {
  const [searchParams] = useSearchParams();
  const { isLoggedIn, pendingAuthIdentity, setupStore } = useStore();
  const [storeName, setStoreName] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const inviteCode = searchParams.get('invite');
  const invitePayload = inviteCode === null ? null : parseStoreInviteCode(inviteCode);
  const isInviteFlow = invitePayload !== null;
  const hasInvalidInvite = inviteCode !== null && invitePayload === null;

  if (isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  if (pendingAuthIdentity === null) {
    return (
      <Navigate
        to={inviteCode === null ? '/login' : `/login?invite=${encodeURIComponent(inviteCode)}`}
        replace
      />
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (isInviteFlow) {
      await setupStore({
        storeName: invitePayload.storeName,
        ownerNickname: invitePayload.ownerNickname,
        memberNickname: nickname,
        membershipRole: 'staff',
        joinedWithInviteCode: inviteCode,
      });
      return;
    }

    await setupStore({
      storeName,
      ownerNickname: nickname,
      memberNickname: nickname,
      membershipRole: 'owner',
    });
  }

  return (
    <section className="screen">
      <header className="screen-header fade-up">
        <p className="eyebrow">설정 단계</p>
        <h1 className="screen-title">
          {isInviteFlow ? '직원 닉네임을 설정하세요' : '매장 정보를 등록하세요'}
        </h1>
        <p className="screen-subtitle">
          {isInviteFlow
            ? '초대코드로 매장에 합류한 뒤, 내 닉네임으로 오픈과 마감 이력을 남길 수 있어요.'
            : '첫 설정만 끝내면 내일부터는 홈에서 바로 체크리스트를 시작할 수 있어요.'}
        </p>
      </header>

      <div className="card note-card fade-up">
        <span className="badge badge--soft">{getAuthSourceLabel(pendingAuthIdentity.authSource)}</span>
        <p className="helper-text">
          {pendingAuthIdentity.tossUserKey === null
            ? '브라우저 데모 로그인으로 진행 중이에요. 실제 Toss 앱에서는 사용자 키가 함께 저장됩니다.'
            : `토스 사용자 키 ${pendingAuthIdentity.tossUserKey} 로 인증됐어요. 완료자 표시는 점주 닉네임으로 관리합니다.`}
        </p>
      </div>

      {hasInvalidInvite ? (
        <div className="card note-card fade-up">
          <span className="badge badge--warm">초대코드 확인 필요</span>
          <p className="helper-text">
            초대코드를 읽지 못했어요. 점주가 다시 공유한 링크나 코드를 확인해 주세요.
          </p>
          <Link to="/login" className="secondary-button secondary-button--link">
            로그인으로 돌아가기
          </Link>
        </div>
      ) : null}

      {isInviteFlow ? (
        <div className="card note-card fade-up">
          <div className="meta-grid">
            <div className="meta-item">
              <span className="meta-label">합류할 매장</span>
              <strong>{invitePayload.storeName}</strong>
            </div>
            <div className="meta-item">
              <span className="meta-label">점주 닉네임</span>
              <strong>{invitePayload.ownerNickname}</strong>
            </div>
          </div>
        </div>
      ) : null}

      {!hasInvalidInvite ? (
        <form className="card form-card fade-up" onSubmit={handleSubmit}>
          {!isInviteFlow ? (
            <label className="field">
              <span className="field-label">매장 이름</span>
              <input
                aria-label="매장 이름"
                className="text-input"
                placeholder="예: 성수 라운드 카페"
                value={storeName}
                onChange={(event) => setStoreName(event.target.value)}
              />
            </label>
          ) : null}

          <label className="field">
            <span className="field-label">{isInviteFlow ? '내 닉네임' : '점주 닉네임'}</span>
            <input
              aria-label={isInviteFlow ? '내 닉네임' : '점주 닉네임'}
              className="text-input"
              placeholder={isInviteFlow ? '예: 오픈 담당 민수' : '예: 매니저 제이'}
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
            />
          </label>

          <button
            type="submit"
            className="primary-button"
            disabled={isInviteFlow ? !nickname.trim() : !storeName.trim() || !nickname.trim()}
          >
            {isInviteFlow ? '매장에 합류하기' : '시작하기'}
          </button>
        </form>
      ) : null}
    </section>
  );
}
