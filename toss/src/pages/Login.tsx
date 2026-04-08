import type { ReactElement } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../hooks/useStore';

export function LoginPage(): ReactElement {
  const { isLoggedIn, isLoggingIn, login, loginError } = useStore();
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('invite');
  const nextPath =
    inviteCode === null ? '/setup' : `/setup?invite=${encodeURIComponent(inviteCode)}`;

  if (isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  return (
    <section className="screen screen--centered">
      <div className="hero-card fade-up">
        <p className="hero-kicker">매일 쓰는 매장 루틴</p>
        <h1 className="hero-title">오픈마감체크</h1>
        <p className="screen-subtitle">
          앱인토스 미니앱으로 오픈과 마감을 정리하고,
          <br />
          오늘 누가 어디까지 끝냈는지 한눈에 확인하세요.
        </p>

        <div className="feature-grid">
          <div className="feature-pill">오픈/마감 한 화면 관리</div>
          <div className="feature-pill">담당자 선택과 완료 이력</div>
          <div className="feature-pill">30일 기록과 스트릭 추적</div>
        </div>

        {inviteCode !== null ? (
          <div className="card note-card">
            <span className="badge badge--soft">초대코드 확인됨</span>
            <p className="helper-text">
              로그인 후 직원 닉네임을 설정하면 매장에 바로 합류할 수 있어요.
            </p>
          </div>
        ) : null}

        <button
          type="button"
          className="primary-button"
          onClick={() => {
            void login(nextPath);
          }}
          disabled={isLoggingIn}
        >
          {isLoggingIn ? '연결 중...' : '토스로 시작하기'}
        </button>

        {loginError !== null ? (
          <div className="card note-card">
            <span className="badge badge--warm">로그인 재시도 필요</span>
            <p className="helper-text">{loginError}</p>
          </div>
        ) : null}

        <p className="helper-text">
          브라우저 개발 환경에서는 자동으로 데모 로그인으로 이어집니다.
        </p>
      </div>
    </section>
  );
}
