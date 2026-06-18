import type { AccessStatus } from '@/app/generated/prisma/client';

export type CompanyOverviewRow = {
  id: string;
  name: string;
  userName: string | null;
  email: string | null;
  domain: string | null;
  logoUrl: string | null;
  createdAt: string;
  accessStatus: AccessStatus;
  subscriptionStatus: string;
  industry: string | null;
  category: string | null;
  metaConnected: boolean;
  shopifyConnected: boolean;
  activeSessionCount: number;
  lastSeenAt: string | null;
};

export type SuperadminOverview = {
  kpis: {
    approvedCompanies: number;
    pendingRequests: number;
    activeSessionsNow: number;
    companiesActiveNow: number;
    metaAdoptionPct: number;
    shopifyAdoptionPct: number;
  };
  charts: {
    accessStatus: { status: string; count: number }[];
    signupsByWeek: { label: string; count: number }[];
    integrationAdoption: { name: string; connected: number; total: number; pct: number }[];
  };
  companies: CompanyOverviewRow[];
};
