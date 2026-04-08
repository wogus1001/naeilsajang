import { CompletionRecord, StreakInfo } from '../types';
import { getTodayKey, shiftDateKey } from './date';

function getCloseDates(history: CompletionRecord[]): Set<string> {
  return new Set(
    history
      .filter((record) => record.type === 'close')
      .map((record) => record.date),
  );
}

export function calcStreak(history: CompletionRecord[]): StreakInfo {
  const closeDates = [...getCloseDates(history)].sort();

  if (closeDates.length === 0) {
    return { current: 0, longest: 0 };
  }

  const closeSet = new Set(closeDates);
  let current = 0;
  let cursor = getTodayKey();

  if (!closeSet.has(cursor)) {
    cursor = shiftDateKey(cursor, -1);
  }

  while (closeSet.has(cursor)) {
    current += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  let longest = 1;
  let chain = 1;

  for (let index = 1; index < closeDates.length; index += 1) {
    const previous = closeDates[index - 1];
    const currentDate = closeDates[index];

    if (shiftDateKey(previous, 1) === currentDate) {
      chain += 1;
      longest = Math.max(longest, chain);
    } else {
      chain = 1;
    }
  }

  return { current, longest };
}

export function getCurrentStreakDates(history: CompletionRecord[]): Set<string> {
  const closeSet = getCloseDates(history);
  const dates = new Set<string>();

  if (closeSet.size === 0) {
    return dates;
  }

  let cursor = getTodayKey();

  if (!closeSet.has(cursor)) {
    cursor = shiftDateKey(cursor, -1);
  }

  while (closeSet.has(cursor)) {
    dates.add(cursor);
    cursor = shiftDateKey(cursor, -1);
  }

  return dates;
}
