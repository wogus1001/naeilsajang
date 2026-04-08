import { createContext, useContext, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { nanoid } from 'nanoid';
import { createDefaultChecklistItems } from '../lib/defaults';
import { getTodayKey, isWithinRecentDays } from '../lib/date';
import { syncRemoteHistory, syncRemoteItems } from '../lib/remoteStore';
import {
  loadHistory,
  loadItems,
  saveHistory,
  saveItems,
  subscribeToLocalStateReplaced,
} from '../lib/storage';
import { calcStreak } from '../lib/streak';
import { ChecklistItem, ChecklistType, CompletionRecord, StreakInfo } from '../types';
import { useStore } from './useStore';

interface ChecklistContextValue {
  items: ChecklistItem[];
  history: CompletionRecord[];
  streak: StreakInfo;
  todayOpen: CompletionRecord | undefined;
  todayClose: CompletionRecord | undefined;
  addItem: (label: string, type: ChecklistType) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, label: string) => void;
  getItemsByType: (type: ChecklistType) => ChecklistItem[];
  saveCompletion: (
    type: ChecklistType,
    checkedIds: string[],
    workerId: string,
    actorNameSnapshot: string,
  ) => void;
  getTodayRecord: (type: ChecklistType) => CompletionRecord | undefined;
  getRecentHistory: (days?: number) => CompletionRecord[];
}

const ChecklistContext = createContext<ChecklistContextValue | null>(null);

interface ChecklistProviderProps {
  children: ReactNode;
}

function getInitialItems(): ChecklistItem[] {
  const stored = loadItems();

  if (stored.length > 0) {
    return stored;
  }

  const defaults = createDefaultChecklistItems();
  saveItems(defaults);
  return defaults;
}

export function ChecklistProvider({ children }: ChecklistProviderProps): ReactElement {
  const { profile } = useStore();
  const [items, setItems] = useState<ChecklistItem[]>(() => getInitialItems());
  const [history, setHistory] = useState<CompletionRecord[]>(() => loadHistory());

  function updateItems(nextItems: ChecklistItem[]): void {
    saveItems(nextItems);
    setItems(nextItems);
  }

  function updateHistory(nextHistory: CompletionRecord[]): void {
    saveHistory(nextHistory);
    setHistory(nextHistory);
  }

  function getItemsByType(type: ChecklistType): ChecklistItem[] {
    return items
      .filter((item) => item.type === type)
      .sort((left, right) => left.order - right.order);
  }

  function addItem(label: string, type: ChecklistType): void {
    const trimmedLabel = label.trim();

    if (!trimmedLabel) {
      return;
    }

    const currentOrders = items
      .filter((item) => item.type === type)
      .map((item) => item.order);
    const nextOrder = currentOrders.length > 0 ? Math.max(...currentOrders) + 1 : 1;

    updateItems([
      ...items,
      {
        id: nanoid(),
        label: trimmedLabel,
        type,
        order: nextOrder,
      },
    ]);
  }

  function removeItem(id: string): void {
    updateItems(items.filter((item) => item.id !== id));
  }

  function updateItem(id: string, label: string): void {
    updateItems(
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              label,
            }
          : item,
      ),
    );
  }

  function getTodayRecord(type: ChecklistType): CompletionRecord | undefined {
    return history.find(
      (record) => record.type === type && record.date === getTodayKey(),
    );
  }

  function saveCompletion(
    type: ChecklistType,
    checkedIds: string[],
    workerId: string,
    actorNameSnapshot: string,
  ): void {
    const todayKey = getTodayKey();
    const existingRecord = history.find(
      (record) => record.type === type && record.date === todayKey,
    );
    const typeItems = getItemsByType(type);
    const nextRecord: CompletionRecord = {
      id: existingRecord?.id ?? nanoid(),
      date: todayKey,
      type,
      completedAt: new Date().toISOString(),
      totalItems: typeItems.length,
      checkedItems: checkedIds,
      workerId,
      actorNameSnapshot: actorNameSnapshot.trim().length > 0 ? actorNameSnapshot.trim() : null,
    };

    const nextHistory = history.filter(
      (record) => !(record.type === type && record.date === todayKey),
    );

    updateHistory([...nextHistory, nextRecord]);
  }

  function getRecentHistory(days: number = 30): CompletionRecord[] {
    return history
      .filter((record) => isWithinRecentDays(record.date, days))
      .sort((left, right) => {
        if (left.date === right.date) {
          return new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime();
        }

        return right.date.localeCompare(left.date);
      });
  }

  const streak = calcStreak(history);
  const todayOpen = getTodayRecord('open');
  const todayClose = getTodayRecord('close');

  useEffect(() => {
    return subscribeToLocalStateReplaced(() => {
      setItems(loadItems());
      setHistory(loadHistory());
    });
  }, []);

  useEffect(() => {
    if (profile === null || profile.storeId === null) {
      return;
    }

    void syncRemoteItems(profile, items);
  }, [items, profile]);

  useEffect(() => {
    if (profile === null || profile.storeId === null) {
      return;
    }

    void syncRemoteHistory(profile, history);
  }, [history, profile]);

  return (
    <ChecklistContext.Provider
      value={{
        items,
        history,
        streak,
        todayOpen,
        todayClose,
        addItem,
        removeItem,
        updateItem,
        getItemsByType,
        saveCompletion,
        getTodayRecord,
        getRecentHistory,
      }}
    >
      {children}
    </ChecklistContext.Provider>
  );
}

export function useChecklist(): ChecklistContextValue {
  const context = useContext(ChecklistContext);

  if (context === null) {
    throw new Error('useChecklist must be used within a ChecklistProvider');
  }

  return context;
}
