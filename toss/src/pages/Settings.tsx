import { useEffect, useState, type ChangeEvent, type ReactElement } from 'react';
import { buildStoreInviteLoginUrl, createStoreInviteCode } from '../lib/inviteCode';
import { useChecklist } from '../hooks/useChecklist';
import { useStore } from '../hooks/useStore';
import { useWorkers } from '../hooks/useWorkers';
import { AuthSource, ChecklistItem, ChecklistType } from '../types';

interface ChecklistSectionProps {
  type: ChecklistType;
  title: string;
  items: ChecklistItem[];
  addItem: (label: string, type: ChecklistType) => void;
  updateItem: (id: string, label: string) => void;
  removeItem: (id: string) => void;
}

function getAuthSourceLabel(source: AuthSource): string {
  switch (source) {
    case 'toss':
      return '실제 Toss 로그인';
    case 'sandbox':
      return 'Toss Sandbox 로그인';
    case 'browser-demo':
      return '브라우저 데모 로그인';
  }
}

function ChecklistSection({
  type,
  title,
  items,
  addItem,
  updateItem,
  removeItem,
}: ChecklistSectionProps): ReactElement {
  const [draft, setDraft] = useState<string>('');

  return (
    <section className="card settings-card fade-up">
      <div className="section-heading section-heading--tight">
        <h2 className="section-title">{title}</h2>
        <p className="section-subtitle">필요한 항목만 남기고 자유롭게 수정할 수 있어요.</p>
      </div>

      <div className="editor-list">
        {items.map((item) => (
          <div key={item.id} className="editor-row">
            <input
              className="text-input"
              value={item.label}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateItem(item.id, event.target.value)
              }
            />
            <button
              type="button"
              className="ghost-button"
              onClick={() => removeItem(item.id)}
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      <div className="inline-form">
        <input
          className="text-input"
          placeholder="새 항목 추가"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            addItem(draft, type);
            setDraft('');
          }}
          disabled={!draft.trim()}
        >
          추가
        </button>
      </div>
    </section>
  );
}

export function SettingsPage(): ReactElement {
  const { profile, logout } = useStore();
  const { workers, addWorker, removeWorker } = useWorkers();
  const { getItemsByType, addItem, removeItem, updateItem } = useChecklist();
  const [workerDraft, setWorkerDraft] = useState<string>('');
  const [inviteCode, setInviteCode] = useState<string>('');
  const [copyMessage, setCopyMessage] = useState<string>('');
  const isOwner = profile?.membershipRole === 'owner';
  const inviteLink =
    inviteCode.length > 0 ? buildStoreInviteLoginUrl(inviteCode) : '';

  useEffect(() => {
    if (profile === null || !isOwner) {
      return;
    }

    setInviteCode(
      createStoreInviteCode({
        storeName: profile.storeName,
        ownerNickname: profile.ownerNickname,
      }),
    );
  }, [isOwner, profile]);

  if (profile === null) {
    return <></>;
  }

  async function copyText(text: string, message: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage(message);
    } catch {
      setCopyMessage('브라우저에서 복사 권한을 확인해 주세요.');
    }
  }

  return (
    <section className="screen">
      <header className="screen-header fade-up">
        <p className="eyebrow">설정</p>
        <h1 className="screen-title">운영 설정</h1>
        <p className="screen-subtitle">점주 정보, 알바생, 체크리스트 항목을 이곳에서 관리합니다.</p>
      </header>

      <section className="card settings-card fade-up">
        <div className="section-heading section-heading--tight">
          <h2 className="section-title">매장 정보</h2>
        </div>
        <div className="meta-grid">
          <div className="meta-item">
            <span className="meta-label">매장명</span>
            <strong>{profile.storeName}</strong>
          </div>
          <div className="meta-item">
            <span className="meta-label">{isOwner ? '점주 닉네임' : '내 닉네임'}</span>
            <strong>{isOwner ? profile.ownerNickname : profile.memberNickname}</strong>
          </div>
          {!isOwner ? (
            <div className="meta-item">
              <span className="meta-label">점주 닉네임</span>
              <strong>{profile.ownerNickname}</strong>
            </div>
          ) : null}
          <div className="meta-item">
            <span className="meta-label">내 역할</span>
            <strong>{isOwner ? '점주' : '직원'}</strong>
          </div>
          <div className="meta-item">
            <span className="meta-label">로그인 상태</span>
            <strong>{getAuthSourceLabel(profile.authSource)}</strong>
          </div>
          <div className="meta-item">
            <span className="meta-label">토스 사용자 키</span>
            <strong>{profile.tossUserKey ?? '브라우저 데모 환경'}</strong>
          </div>
        </div>
      </section>

      {isOwner ? (
        <section className="card settings-card fade-up">
          <div className="section-heading section-heading--tight">
            <h2 className="section-title">직원 초대</h2>
            <p className="section-subtitle">초대 링크로 들어온 직원은 닉네임을 정하고 바로 합류할 수 있어요.</p>
          </div>

          <div className="invite-panel">
            <div className="invite-code-card">
              <span className="meta-label">초대 코드</span>
              <code className="invite-code">{inviteCode}</code>
            </div>
            <div className="invite-code-card">
              <span className="meta-label">초대 링크</span>
              <p className="invite-link">{inviteLink}</p>
            </div>
            <div className="invite-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setInviteCode(
                    createStoreInviteCode({
                      storeName: profile.storeName,
                      ownerNickname: profile.ownerNickname,
                    }),
                  )
                }
              >
                새 코드 발급
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  void copyText(inviteCode, '초대 코드를 복사했어요.');
                }}
              >
                코드 복사
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  void copyText(inviteLink, '초대 링크를 복사했어요.');
                }}
              >
                링크 복사
              </button>
            </div>
            {copyMessage.length > 0 ? <p className="helper-text">{copyMessage}</p> : null}
          </div>
        </section>
      ) : null}

      {isOwner ? (
        <section className="card settings-card fade-up">
          <div className="section-heading section-heading--tight">
            <h2 className="section-title">알바생 관리</h2>
            <p className="section-subtitle">체크리스트 저장 시 완료자로 선택할 수 있어요.</p>
          </div>

          <div className="editor-list">
            {workers.length === 0 ? (
              <p className="helper-text">아직 등록된 알바생이 없어요.</p>
            ) : (
              workers.map((worker) => (
                <div key={worker.id} className="editor-row">
                  <div className="inline-label">{worker.name}</div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => removeWorker(worker.id)}
                  >
                    삭제
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="inline-form">
            <input
              className="text-input"
              placeholder="이름 추가"
              value={workerDraft}
              onChange={(event) => setWorkerDraft(event.target.value)}
            />
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                addWorker(workerDraft);
                setWorkerDraft('');
              }}
              disabled={!workerDraft.trim()}
            >
              추가
            </button>
          </div>
        </section>
      ) : (
        <section className="card settings-card fade-up">
          <div className="section-heading section-heading--tight">
            <h2 className="section-title">매장 합류 상태</h2>
            <p className="section-subtitle">지금은 점주가 만든 초대코드로 연결된 상태예요.</p>
          </div>
          <p className="helper-text">
            내 닉네임은 <strong>{profile.memberNickname}</strong> 으로 저장돼 있고, 체크리스트 완료 이력에도 같은 이름으로 남아요.
          </p>
        </section>
      )}

      {isOwner ? (
        <ChecklistSection
          type="open"
          title="오픈 항목"
          items={getItemsByType('open')}
          addItem={addItem}
          updateItem={updateItem}
          removeItem={removeItem}
        />
      ) : null}

      {isOwner ? (
        <ChecklistSection
          type="close"
          title="마감 항목"
          items={getItemsByType('close')}
          addItem={addItem}
          updateItem={updateItem}
          removeItem={removeItem}
        />
      ) : null}

      <button type="button" className="danger-button fade-up" onClick={logout}>
        로그아웃
      </button>
    </section>
  );
}
