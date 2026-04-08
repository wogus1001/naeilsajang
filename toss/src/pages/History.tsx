import type { ReactElement } from 'react';
import { useChecklist } from '../hooks/useChecklist';
import { useStore } from '../hooks/useStore';
import { useWorkers } from '../hooks/useWorkers';
import { formatDisplayDate, formatDisplayTime } from '../lib/date';
import { getCurrentStreakDates } from '../lib/streak';
import { CompletionRecord } from '../types';

function resolveActorName(
  record: CompletionRecord,
  ownerName: string,
  workerMap: Map<string, string>,
): string {
  if (record.actorNameSnapshot !== null && record.actorNameSnapshot.trim().length > 0) {
    return record.actorNameSnapshot;
  }

  if (record.workerId === 'owner') {
    return ownerName;
  }

  return workerMap.get(record.workerId) ?? '삭제된 직원';
}

function groupByDate(records: CompletionRecord[]): Array<[string, CompletionRecord[]]> {
  const grouped = new Map<string, CompletionRecord[]>();

  records.forEach((record) => {
    const current = grouped.get(record.date) ?? [];
    current.push(record);
    grouped.set(record.date, current);
  });

  return [...grouped.entries()];
}

export function HistoryPage(): ReactElement {
  const { profile } = useStore();
  const { workers } = useWorkers();
  const { history, getRecentHistory } = useChecklist();

  if (profile === null) {
    return <></>;
  }

  const recentHistory = getRecentHistory();
  const streakDates = getCurrentStreakDates(history);
  const workerMap = new Map(workers.map((worker) => [worker.id, worker.name]));
  const groupedHistory = groupByDate(recentHistory);

  return (
    <section className="screen">
      <header className="screen-header fade-up">
        <p className="eyebrow">기록</p>
        <h1 className="screen-title">최근 30일 기록</h1>
        <p className="screen-subtitle">오픈과 마감 기록을 날짜별로 다시 확인할 수 있어요.</p>
      </header>

      {groupedHistory.length === 0 ? (
        <div className="card empty-card fade-up">
          <h2 className="card-title">아직 저장된 기록이 없어요</h2>
          <p className="card-copy">오늘의 오픈 또는 마감을 완료하면 이곳에 쌓입니다.</p>
        </div>
      ) : (
        <div className="stack">
          {groupedHistory.map(([date, records]) => (
            <article key={date} className="card history-day fade-up">
              <div className="card-topline">
                <span className="small-metric">{formatDisplayDate(date)}</span>
                {streakDates.has(date) ? (
                  <span className="badge badge--warm">연속 마감</span>
                ) : null}
              </div>

              <div className="history-list">
                {records
                  .sort((left, right) => left.type.localeCompare(right.type))
                  .map((record) => (
                    <div key={record.id} className="history-record">
                      <div className="history-record-copy">
                        <div className="history-record-heading">
                          <span
                            className={
                              record.type === 'open' ? 'badge badge--soft' : 'badge badge--warm'
                            }
                          >
                            {record.type === 'open' ? '오픈' : '마감'}
                          </span>
                          <span className="history-actor">
                            담당자 {resolveActorName(record, profile.ownerNickname, workerMap)}
                          </span>
                        </div>
                        <h2 className="history-record-title">
                          {record.type === 'open'
                            ? '오픈 체크리스트를 저장했어요'
                            : '마감 체크리스트를 저장했어요'}
                        </h2>
                      </div>
                      <div className="history-meta">
                        <strong>{formatDisplayTime(record.completedAt)}</strong>
                        <span className="helper-text">
                          {record.checkedItems.length}/{record.totalItems} 완료
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
