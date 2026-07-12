import { createContext, useContext } from 'react';
import { useSyncStatus } from '../hooks/useSyncStatus';

const SyncStatusContext = createContext(null);

export function SyncStatusProvider({ children }) {
  const value = useSyncStatus();
  return <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>;
}

export function useSyncStatusContext() {
  const ctx = useContext(SyncStatusContext);
  if (!ctx) {
    throw new Error('useSyncStatusContext must be used within a SyncStatusProvider');
  }
  return ctx;
}
