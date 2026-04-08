import { useEffect, useState, type ReactElement } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useChecklist } from '../hooks/useChecklist';
import { useStore } from '../hooks/useStore';
import { useWorkers } from '../hooks/useWorkers';
import { formatDisplayTime } from '../lib/date';
import { ChecklistItem, ChecklistType } from '../types';

type ChecklistIconTone = 'blue' | 'sky' | 'mint' | 'gold' | 'orange' | 'slate';
type ChecklistIconKind =
  | 'light'
  | 'hvac'
  | 'register'
  | 'cash'
  | 'broom'
  | 'store'
  | 'flame'
  | 'lock'
  | 'default';

interface ChecklistVisual {
  kind: ChecklistIconKind;
  tone: ChecklistIconTone;
}

function isChecklistType(value: string | undefined): value is ChecklistType {
  return value === 'open' || value === 'close';
}

function getChecklistVisual(item: ChecklistItem): ChecklistVisual {
  const label = item.label;

  if (label.includes('가스')) {
    return {
      kind: 'flame',
      tone: 'orange',
    };
  }

  if (label.includes('문단속') || label.includes('잠금')) {
    return {
      kind: 'lock',
      tone: 'blue',
    };
  }

  if (label.includes('간판') || label.includes('외부')) {
    return {
      kind: 'store',
      tone: 'orange',
    };
  }

  if (/pos/i.test(label) || label.includes('금전등록기')) {
    return {
      kind: 'register',
      tone: 'blue',
    };
  }

  if (label.includes('전등')) {
    return {
      kind: 'light',
      tone: 'gold',
    };
  }

  if (label.includes('냉난방')) {
    return {
      kind: 'hvac',
      tone: 'sky',
    };
  }

  if (label.includes('현금') || label.includes('정산') || label.includes('시재')) {
    return {
      kind: 'cash',
      tone: 'mint',
    };
  }

  if (label.includes('청소')) {
    return {
      kind: 'broom',
      tone: 'slate',
    };
  }

  return {
    kind: 'default',
    tone: 'blue',
  };
}

function ChecklistItemIcon({ kind }: { kind: ChecklistIconKind }): ReactElement {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'check-icon-svg',
    'aria-hidden': true,
  };

  switch (kind) {
    case 'light':
      return (
        <svg {...commonProps}>
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M8.5 14.5c-1.4-1-2.5-2.7-2.5-4.8a6 6 0 1 1 12 0c0 2.1-1.1 3.8-2.5 4.8-.7.5-1.2 1.1-1.4 1.8H9.9c-.2-.7-.7-1.3-1.4-1.8Z" />
        </svg>
      );
    case 'hvac':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="1.6" />
          <path d="M12 4.5v4.2" />
          <path d="M12 15.3v4.2" />
          <path d="M4.5 12h4.2" />
          <path d="M15.3 12h4.2" />
          <path d="m6.7 6.7 3 3" />
          <path d="m14.3 14.3 3 3" />
          <path d="m17.3 6.7-3 3" />
          <path d="m9.7 14.3-3 3" />
        </svg>
      );
    case 'register':
      return (
        <svg {...commonProps}>
          <rect x="6.5" y="4.5" width="11" height="15" rx="2.6" />
          <path d="M9 7.7h6" />
          <path d="M9 10.9h1.3" />
          <path d="M11.35 10.9h1.3" />
          <path d="M13.7 10.9H15" />
          <path d="M9 13.4h1.3" />
          <path d="M11.35 13.4h1.3" />
          <path d="M13.7 13.4H15" />
          <path d="M9 16.3h6" />
        </svg>
      );
    case 'cash':
      return (
        <svg {...commonProps}>
          <rect x="3" y="6" width="18" height="12" rx="3" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M7 9h0" />
          <path d="M17 15h0" />
        </svg>
      );
    case 'broom':
      return (
        <svg {...commonProps}>
          <path d="M14 4 8 10" />
          <path d="m13.2 4.8 2 2" />
          <path d="M7 11 4.8 16.8a1.2 1.2 0 0 0 1.1 1.7h8.2a1.2 1.2 0 0 0 1.1-1.7L13 11" />
          <path d="M7.2 14.5h5.6" />
        </svg>
      );
    case 'store':
      return (
        <svg {...commonProps}>
          <path d="M4.5 9 6 5.5h12L19.5 9" />
          <path d="M5.5 9h13v1.8a2.3 2.3 0 0 1-2.3 2.2H7.8a2.3 2.3 0 0 1-2.3-2.2Z" />
          <path d="M6.5 13v5.5h11V13" />
          <path d="M10 18.5V15h4v3.5" />
        </svg>
      );
    case 'flame':
      return (
        <svg {...commonProps}>
          <path d="M12 4.5c1.8 2.1 3.8 3.7 3.8 6.7A3.8 3.8 0 1 1 8.2 11c0-1.8.9-3.1 2.1-4.6.3 1.2 1 2 1.7 2.5.4-1.6.7-2.8 0-4.4Z" />
        </svg>
      );
    case 'lock':
      return (
        <svg {...commonProps}>
          <rect x="5" y="11" width="14" height="10" rx="3" />
          <path d="M8 11V8.5A4 4 0 0 1 12 4a4 4 0 0 1 4 4.5V11" />
          <path d="M12 15v2" />
        </svg>
      );
    default:
      return (
        <svg {...commonProps}>
          <rect x="6" y="4.5" width="12" height="15" rx="2.5" />
          <path d="M9 8h6" />
          <path d="M9 11.5h6" />
          <path d="m9.4 15 1.7 1.7 3.5-3.5" />
        </svg>
      );
  }
}

export function ChecklistPage(): ReactElement {
  const navigate = useNavigate();
  const { type } = useParams();
  const { profile } = useStore();
  const { workers } = useWorkers();
  const { getItemsByType, getTodayRecord, saveCompletion } = useChecklist();

  if (!isChecklistType(type) || profile === null) {
    return <Navigate to="/" replace />;
  }

  const checklistType: ChecklistType = type;
  const currentProfile = profile;
  const items = getItemsByType(checklistType);
  const todayRecord = getTodayRecord(checklistType);
  const defaultActorId =
    todayRecord?.workerId ??
    (currentProfile.membershipRole === 'staff' && currentProfile.memberWorkerId !== null
      ? currentProfile.memberWorkerId
      : 'owner');
  const [selectedActor, setSelectedActor] = useState<string>(defaultActorId);
  const [checkedIds, setCheckedIds] = useState<string[]>(todayRecord?.checkedItems ?? []);

  useEffect(() => {
    setSelectedActor(
      todayRecord?.workerId ??
        (currentProfile.membershipRole === 'staff' && currentProfile.memberWorkerId !== null
          ? currentProfile.memberWorkerId
          : 'owner'),
    );
    setCheckedIds(todayRecord?.checkedItems ?? []);
  }, [currentProfile.memberWorkerId, currentProfile.membershipRole, todayRecord]);

  const progress = items.length === 0 ? 0 : Math.round((checkedIds.length / items.length) * 100);
  const title = checklistType === 'open' ? '오픈 체크리스트' : '마감 체크리스트';

  function toggleItem(id: string): void {
    setCheckedIds((current) =>
      current.includes(id)
        ? current.filter((checkedId) => checkedId !== id)
        : [...current, id],
    );
  }

  function handleSave(): void {
    const actorNameSnapshot =
      selectedActor === 'owner'
        ? currentProfile.ownerNickname
        : workers.find((worker) => worker.id === selectedActor)?.name ?? currentProfile.memberNickname;

    saveCompletion(checklistType, checkedIds, selectedActor, actorNameSnapshot);
    navigate('/');
  }

  return (
    <section className="screen">
      <header className="screen-header fade-up">
        <p className="eyebrow">체크리스트</p>
        <h1 className="screen-title">{title}</h1>
        <p className="screen-subtitle">
          담당자를 선택하고, 오늘 완료한 항목만 체크해서 저장하세요.
        </p>
      </header>

      <div className="card note-card checklist-assignee-card fade-up">
        <div className="card-topline">
          <span className="small-metric">담당자 선택</span>
          {todayRecord ? (
            <span className="helper-text">{formatDisplayTime(todayRecord.completedAt)} 기준 저장본</span>
          ) : null}
        </div>
        <div className="chip-row">
          <button
            type="button"
            className={selectedActor === 'owner' ? 'select-chip select-chip--active' : 'select-chip'}
            onClick={() => setSelectedActor('owner')}
          >
            {currentProfile.ownerNickname}
          </button>
          {workers.map((worker) => (
            <button
              key={worker.id}
              type="button"
              className={selectedActor === worker.id ? 'select-chip select-chip--active' : 'select-chip'}
              onClick={() => setSelectedActor(worker.id)}
            >
              {worker.name}
            </button>
          ))}
        </div>
      </div>

      <div className="card progress-card fade-up">
        <div className="card-topline">
          <span className="small-metric">진행률</span>
          <strong>{checkedIds.length}/{items.length}</strong>
        </div>
        <div className="progress-track">
          <div className="progress-value" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card empty-card fade-up">
          <h2 className="card-title">등록된 항목이 없어요</h2>
          <p className="card-copy">설정에서 체크리스트 항목을 먼저 추가해 주세요.</p>
          <Link to="/settings" className="secondary-button secondary-button--link">
            설정으로 이동
          </Link>
        </div>
      ) : (
        <div className="stack">
          {items.map((item) => {
            const checked = checkedIds.includes(item.id);
            const visual = getChecklistVisual(item);

            return (
              <button
                key={item.id}
                type="button"
                className={checked ? 'check-row check-row--checked fade-up' : 'check-row fade-up'}
                onClick={() => toggleItem(item.id)}
              >
                <span className={`check-icon-badge check-icon-badge--${visual.tone}`}>
                  <ChecklistItemIcon kind={visual.kind} />
                </span>

                <span className="check-copy-group">
                  <span className="check-label">{item.label}</span>
                </span>

                <span className="check-meta">
                  <span className={checked ? 'check-box check-box--checked' : 'check-box'} aria-hidden="true">
                    <span className="check-box-mark" />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="sticky-action">
        <button type="button" className="primary-button" onClick={handleSave}>
          {todayRecord ? '오늘 기록 업데이트' : '완료하기'}
        </button>
      </div>
    </section>
  );
}
