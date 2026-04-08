import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useChecklist } from '../hooks/useChecklist';
import { useStore } from '../hooks/useStore';
import { useWorkers } from '../hooks/useWorkers';
import { formatDisplayTime, formatLongToday } from '../lib/date';
import { ChecklistType, CompletionRecord } from '../types';

const STREAK_MILESTONES = [1, 3, 7, 14, 30] as const;

interface ChecklistCardProps {
  title: string;
  type: ChecklistType;
  record: CompletionRecord | undefined;
  ownerName: string;
  workerNameMap: Map<string, string>;
}

function resolveActorName(
  workerId: string,
  ownerName: string,
  workerNameMap: Map<string, string>,
): string {
  if (workerId === 'owner') {
    return ownerName;
  }

  return workerNameMap.get(workerId) ?? '삭제된 직원';
}

function getNextMilestone(current: number): number | null {
  return STREAK_MILESTONES.find((milestone) => milestone > current) ?? null;
}

function getPreviousMilestone(current: number): number {
  const previous = [...STREAK_MILESTONES]
    .reverse()
    .find((milestone) => milestone <= current);

  return previous ?? 0;
}

function getMilestoneProgress(current: number): number {
  if (current <= 0) {
    return 0;
  }

  const nextMilestone = getNextMilestone(current);

  if (nextMilestone === null) {
    return 100;
  }

  const previousMilestone = getPreviousMilestone(current);
  const span = Math.max(nextMilestone - previousMilestone, 1);
  return ((current - previousMilestone) / span) * 100;
}

function ChecklistStatusCard({
  title,
  type,
  record,
  ownerName,
  workerNameMap,
}: ChecklistCardProps): ReactElement {
  const isDone = record !== undefined;
  const accentClass = type === 'open' ? 'card-accent--blue' : 'card-accent--sunset';

  return (
    <article className={`card checklist-card ${accentClass} fade-up`}>
      <div className="card-topline">
        <span className={isDone ? 'badge badge--done' : 'badge badge--muted'}>
          {isDone ? '완료됨' : '미완료'}
        </span>
        <span className="small-metric">{title}</span>
      </div>

      <h2 className="card-title">{title}</h2>
      <p className="card-copy">
        {isDone
          ? `${resolveActorName(record.workerId, ownerName, workerNameMap)} 님이 ${formatDisplayTime(record.completedAt)}에 ${record.checkedItems.length}/${record.totalItems} 항목을 저장했어요.`
          : '오늘 체크리스트를 시작하고 완료 상태를 남겨보세요.'}
      </p>

      <Link to={`/checklist/${type}`} className="secondary-button secondary-button--link">
        {isDone ? '다시 열어보기' : '시작하기'}
      </Link>
    </article>
  );
}

function StreakHero({
  current,
  longest,
}: {
  current: number;
  longest: number;
}): ReactElement {
  const nextMilestone = getNextMilestone(current);
  const progress = getMilestoneProgress(current);
  const displayCurrent = Math.max(current, 0);
  const best = Math.max(longest, current);

  return (
    <section className="streak-panel fade-up">
      <div className="streak-panel-top">
        <span className="streak-pill">연속 마감</span>
        <span className="streak-best">최장 {best}일</span>
      </div>

      <div className="streak-panel-main">
        <strong className="streak-value">{displayCurrent}일</strong>
        <div className="streak-value-copy">
          <span className="streak-headline">연속 마감 완료</span>
          <p className="streak-subline">
            {nextMilestone === null
              ? '모든 스트릭 배지를 달성했어요.'
              : current > 0
                ? `다음 배지까지 ${nextMilestone - current}일 남았어요.`
                : '오늘 마감을 완료하면 첫 배지를 획득할 수 있어요.'}
          </p>
        </div>
      </div>

      <div className="streak-badge-row" aria-label="스트릭 배지 단계">
        {STREAK_MILESTONES.map((milestone) => {
          const state =
            current >= milestone
              ? 'streak-badge streak-badge--earned'
              : nextMilestone === milestone
                ? 'streak-badge streak-badge--next'
                : 'streak-badge';

          return (
            <div key={milestone} className={state}>
              <span className="streak-badge-flame">✦</span>
              <span className="streak-badge-day">{milestone}일</span>
            </div>
          );
        })}
      </div>

      <div className="streak-meter" aria-hidden="true">
        <div className="streak-meter-fill" style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}

export function HomePage(): ReactElement {
  const { profile } = useStore();
  const { workers } = useWorkers();
  const { streak, todayOpen, todayClose } = useChecklist();

  if (profile === null) {
    return <></>;
  }

  const workerNameMap = new Map(workers.map((worker) => [worker.id, worker.name]));

  return (
    <section className="screen">
      <header className="screen-header fade-up">
        <h1 className="screen-title">{profile.storeName}</h1>
        <p className="screen-subtitle">{formatLongToday()}</p>
      </header>

      <StreakHero current={streak.current} longest={streak.longest} />

      <div className="section-heading fade-up">
        <h2 className="section-title">오늘의 체크리스트</h2>
        <p className="section-subtitle">오픈과 마감을 각각 저장할 수 있어요.</p>
      </div>

      <div className="stack">
        <ChecklistStatusCard
          title="오픈 체크리스트"
          type="open"
          record={todayOpen}
          ownerName={profile.ownerNickname}
          workerNameMap={workerNameMap}
        />
        <ChecklistStatusCard
          title="마감 체크리스트"
          type="close"
          record={todayClose}
          ownerName={profile.ownerNickname}
          workerNameMap={workerNameMap}
        />
      </div>
    </section>
  );
}
