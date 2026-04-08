import { createContext, useContext, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { nanoid } from 'nanoid';
import { syncRemoteWorkers } from '../lib/remoteStore';
import { loadWorkers, saveWorkers, subscribeToLocalStateReplaced } from '../lib/storage';
import { Worker } from '../types';
import { useStore } from './useStore';

interface WorkersContextValue {
  workers: Worker[];
  addWorker: (name: string) => void;
  removeWorker: (id: string) => void;
}

const WorkersContext = createContext<WorkersContextValue | null>(null);

interface WorkersProviderProps {
  children: ReactNode;
}

export function WorkersProvider({ children }: WorkersProviderProps): ReactElement {
  const { profile } = useStore();
  const [workers, setWorkers] = useState<Worker[]>(() => loadWorkers());

  function updateWorkers(nextWorkers: Worker[]): void {
    saveWorkers(nextWorkers);
    setWorkers(nextWorkers);
  }

  function addWorker(name: string): void {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return;
    }

    updateWorkers([
      ...workers,
      {
        id: nanoid(),
        name: trimmedName,
        addedAt: new Date().toISOString(),
      },
    ]);
  }

  function removeWorker(id: string): void {
    updateWorkers(workers.filter((worker) => worker.id !== id));
  }

  useEffect(() => {
    if (
      profile === null ||
      profile.membershipRole !== 'staff' ||
      profile.memberWorkerId === null ||
      profile.memberNickname.trim().length === 0
    ) {
      return;
    }

    const existingWorker = workers.find((worker) => worker.id === profile.memberWorkerId);

    if (existingWorker?.name === profile.memberNickname) {
      return;
    }

    const nextWorkers =
      existingWorker === undefined
        ? [
            ...workers,
            {
              id: profile.memberWorkerId,
              name: profile.memberNickname,
              addedAt: profile.createdAt,
            },
          ]
        : workers.map((worker) =>
            worker.id === profile.memberWorkerId
              ? {
                  ...worker,
                  name: profile.memberNickname,
                }
              : worker,
          );

    updateWorkers(nextWorkers);
  }, [
    profile,
    workers,
  ]);

  useEffect(() => {
    return subscribeToLocalStateReplaced(() => {
      setWorkers(loadWorkers());
    });
  }, []);

  useEffect(() => {
    if (profile === null || profile.storeId === null) {
      return;
    }

    void syncRemoteWorkers(profile, workers);
  }, [profile, workers]);

  return (
    <WorkersContext.Provider value={{ workers, addWorker, removeWorker }}>
      {children}
    </WorkersContext.Provider>
  );
}

export function useWorkers(): WorkersContextValue {
  const context = useContext(WorkersContext);

  if (context === null) {
    throw new Error('useWorkers must be used within a WorkersProvider');
  }

  return context;
}
