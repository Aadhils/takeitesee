'use client';

import { createContext, useContext, type ReactNode } from 'react';

export type AdminAccessSummary = {
  isSuperAdmin: boolean;
  scopeTypes: string[];
  scopeCount: number;
  canManage: boolean;
};

const AdminAccessContext = createContext<AdminAccessSummary>({
  isSuperAdmin: false,
  scopeTypes: [],
  scopeCount: 0,
  canManage: false,
});

export function AdminAccessProvider({ value, children }: { value: AdminAccessSummary; children: ReactNode }) {
  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>;
}

export function useAdminAccess() {
  return useContext(AdminAccessContext);
}
